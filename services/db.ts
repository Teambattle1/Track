import { supabase } from '../lib/supabase';
import { Game, GamePoint, TaskTemplate, TaskList, Team, TeamMemberData, PlaygroundTemplate, AccountUser, AdminMessage, Coordinate, GameChangeLogEntry, MediaSubmission, MapStyleId } from '../types';
import { DEMO_TASKS, DEMO_LISTS, getDemoGames } from '../utils/demoContent';
import { detectLanguageFromText, normalizeLanguage } from '../utils/i18n';

const logError = (context: string, error: any) => {
    if (error?.code === '42P01') {
        console.warn(`[DB Service] Table missing in ${context} (42P01). Run Database Setup.`);
        return;
    }

    // Enhanced error logging with network diagnostics
    const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    const errorDetails = {
        message: errorMsg,
        code: error?.code,
        status: error?.status,
        statusText: error?.statusText,
        name: error?.name
    };

    console.error(`[DB Service] Error in ${context}:`, errorMsg);

    // Format error details as a readable string
    const detailsArray = Object.entries(errorDetails)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

    if (detailsArray) {
        console.error(`[DB Service] Error details: ${detailsArray}`);
    }

    // Special handling for network errors
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Load failed') || errorMsg.includes('fetch') || errorMsg.includes('NetworkError')) {
        console.error(`[DB Service] ❌ SUPABASE CONNECTION FAILED

📡 Most Likely Causes:
   1. ⏸️  Supabase project is PAUSED (free tier auto-pauses after 7 days)
   2. 🗑️  Supabase project was DELETED
   3. 🔒 CORS/Network policy blocking requests
   4. 🌐 Internet connection issues

💡 IMMEDIATE ACTIONS:
   1. Open Supabase Dashboard: https://supabase.com/dashboard
   2. Check if project exists and is active
   3. Click "Resume Project" if paused
   4. Verify project URL: ${(supabase as any).supabaseUrl || 'unknown'}

🛠️ SOLUTIONS:
   - Create new Supabase project if deleted
   - Update credentials in app settings
   - Switch to demo mode (no database needed)
        `);

        // Dispatch custom event to show diagnostic modal
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('supabase-connection-error', {
                detail: { error: errorMsg, context }
            }));
        }
    }
};

// UUID validation helper
const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
};


// Configuration for large table fetches
const CHUNK_SIZE = 25; // Fetch 25 rows at a time (reduced from 50 to prevent timeouts on cold starts)
const LIBRARY_CHUNK_SIZE = 50; // Larger chunks for library to reduce request spam
const TAGS_CHUNK_SIZE = 15; // Smaller chunks for tag fetching (large data objects)
const FETCH_TIMEOUT_MS = 40000; // 40 second timeout per chunk (increased from 20s for cold starts/slow servers)
const TAGS_FETCH_TIMEOUT_MS = 8000; // 8 second timeout for tag fetches (increased from 5s)
const LIBRARY_FETCH_TIMEOUT_MS = 25000; // 25 second timeout for library fetches (increased from 15s)

// Retry helper for timeout and network errors with exponential backoff
const retryWithBackoff = async <T>(fn: () => PromiseLike<T>, context: string, maxRetries = 3, timeoutMs?: number): Promise<T> => {
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
            // Detect retryable errors (timeout or network failures)
            const isTimeout =
                e?.message?.includes('timeout') ||
                e?.message?.includes('canceling statement') ||
                e?.code === 'QUERY_TIMEOUT' ||
                e?.code === '57014'; // Postgres timeout error code

            const isNetworkError =
                e?.message?.includes('Failed to fetch') ||
                e?.message?.includes('Load failed') ||
                e?.message?.includes('fetch') ||
                e?.message?.includes('network') ||
                e?.name === 'TypeError'; // Failed to fetch is a TypeError

            const shouldRetry = (isTimeout || isNetworkError) && attempt < maxRetries - 1;

            if (!shouldRetry) throw e;

            const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 second wait
            const errorType = isNetworkError ? 'Network error' : 'Timeout';
            const errorMsg = e?.message || String(e);
            console.warn(`[DB Service] ${errorType} in ${context}: ${errorMsg}`);
            console.warn(`[DB Service] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
};

// Connection test utility
export const testDatabaseConnection = async (): Promise<{ success: boolean; error?: string; latency?: number }> => {
    const startTime = Date.now();
    try {
        // Simple query to test connection
        const { data, error } = await Promise.race([
            supabase.from('games').select('id').limit(1),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout after 5s')), 5000)
            )
        ]);

        const latency = Date.now() - startTime;

        if (error) {
            return { success: false, error: error.message, latency };
        }

        console.log(`[DB Service] ✅ Connection test passed (${latency}ms)`);
        return { success: true, latency };
    } catch (e: any) {
        const latency = Date.now() - startTime;
        console.debug(`[DB Service] ℹ️  Connection test (${latency}ms):`, e.message);
        return { success: false, error: e.message, latency };
    }
};

// Fetch large tables in chunks to prevent timeout
const fetchInChunks = async <T>(
    query: (offset: number, limit: number) => PromiseLike<{ data: any[] | null; error: any }>,
    context: string,
    chunkSize: number = CHUNK_SIZE,
    timeoutMs?: number
): Promise<T[]> => {
    const results: T[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            // Use fewer retries for library to fail faster and trigger fallback
            const retries = context.includes('fetchLibrary') ? 1 : 2;

            const { data, error } = await retryWithBackoff(
                () => query(offset, chunkSize),
                `${context}[offset=${offset}]`,
                retries,
                timeoutMs
            );

            if (error) {
                const errorMessage = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
                const errorCode = error?.code ? ` (${error.code})` : '';
                console.error(`[DB Service] Query error at offset ${offset}${errorCode}:`, errorMessage);
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
            CHUNK_SIZE,
            FETCH_TIMEOUT_MS
        );
        return rows.map((row: any) => {
            try {
                const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                return { ...rowData, id: row.id, dbUpdatedAt: row.updated_at };
            } catch (parseError) {
                console.error('[DB Service] Failed to parse game data for row:', row.id, parseError);
                return null;
            }
        }).filter(Boolean) as Game[];
    } catch (e) {
        logError('fetchGames', e);
        // Try fallback: fetch a smaller batch without chunking as last resort
        try {
            console.warn('[DB Service] Attempting fetchGames fallback (small batch)...');
            const { data, error } = await Promise.race([
                supabase.from('games').select('id, data, updated_at').limit(250).order('id', { ascending: false }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Fallback query timeout after 30s')), 30000)
                )
            ]);

            if (error) throw error;
            if (!data) return [];
            return data.map((row: any) => {
                try {
                    const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                    return { ...rowData, id: row.id, dbUpdatedAt: row.updated_at };
                } catch (parseError) {
                    console.error('[DB Service] Failed to parse game data for row:', row.id, parseError);
                    return null;
                }
            }).filter(Boolean) as Game[];
        } catch (fallbackError) {
            logError('fetchGames[fallback]', fallbackError);
            return [];
        }
    }
};

export const saveGames = async (
    games: Game[],
    opts?: { chunkSize?: number; onProgress?: (info: { completed: number; total: number }) => void }
): Promise<{ ok: boolean }> => {
    try {
        if (!games || games.length === 0) return { ok: true };

        // Games can be large JSON objects; keep chunks small to avoid DB statement timeouts.
        const chunkSize = Math.max(1, Math.min(opts?.chunkSize ?? 2, 10));
        const updatedAt = new Date().toISOString();
        const chunks = chunkArray(games, chunkSize);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            opts?.onProgress?.({ completed: i, total: chunks.length });

            await retryWithBackoff(
                () =>
                    supabase
                        .from('games')
                        .upsert(
                            chunk.map(g => ({ id: g.id, data: g, updated_at: updatedAt })),
                            { onConflict: 'id' }
                        )
                        .then(result => {
                            if (result.error) throw result.error;
                            return result;
                        }),
                `saveGames[chunk=${i + 1}/${chunks.length}]`
            );
        }

        opts?.onProgress?.({ completed: chunks.length, total: chunks.length });
        return { ok: true };
    } catch (e) {
        logError('saveGames', e);
        return { ok: false };
    }
};

export const saveGame = async (game: Game) => {
    const { ok } = await saveGames([game]);
    if (!ok) {
        console.warn('[DB Service] saveGame failed (see previous error for details)');
    }
};

/**
 * Update a game with partial data (merge updates with existing game)
 * @param gameId - Game ID to update
 * @param updates - Partial game data to merge
 * @returns Updated game object or null if failed
 */
export const updateGame = async (gameId: string, updates: Partial<Game>): Promise<Game | null> => {
    try {
        const existing = await fetchGame(gameId);
        if (!existing) {
            console.error('[DB] updateGame: Game not found:', gameId);
            return null;
        }

        const updated: Game = { ...existing, ...updates };
        await saveGame(updated);
        return updated;
    } catch (e) {
        logError('updateGame', e);
        return null;
    }
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

// --- MAP STYLES ---
export const countMapStyleUsage = async (mapStyleId: string): Promise<number> => {
    try {
        const games = await fetchGames();
        return games.filter(game => game.defaultMapStyle === mapStyleId).length;
    } catch (e) {
        logError('countMapStyleUsage', e);
        return 0;
    }
};

export const replaceMapStyleInGames = async (oldStyleId: string, newStyleId: string = 'osm'): Promise<number> => {
    try {
        const games = await fetchGames();
        const affectedGames = games.filter(game => game.defaultMapStyle === oldStyleId);

        // Update each game
        for (const game of affectedGames) {
            const updatedGame = {
                ...game,
                defaultMapStyle: newStyleId as MapStyleId
            };
            await saveGame(updatedGame);
        }

        return affectedGames.length;
    } catch (e) {
        logError('replaceMapStyleInGames', e);
        return 0;
    }
};

// --- GAME LOCATION HISTORY ---
export const saveGameLocationHistory = async (
    gameId: string,
    teamPaths: Record<string, any[]>
): Promise<boolean> => {
    try {
        const historyData = {
            game_id: gameId,
            team_paths: teamPaths,
            timestamp: Date.now(),
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('game_location_history')
            .upsert(historyData, {
                onConflict: 'game_id',
                ignoreDuplicates: false,
            });

        if (error) {
            logError('saveGameLocationHistory', error);
            return false;
        }

        return true;
    } catch (error) {
        logError('saveGameLocationHistory', error);
        return false;
    }
};

export const fetchGameLocationHistory = async (
    gameId: string
): Promise<Record<string, any[]> | null> => {
    try {
        const { data, error } = await supabase
            .from('game_location_history')
            .select('team_paths')
            .eq('game_id', gameId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No history found
                return null;
            }
            logError('fetchGameLocationHistory', error);
            return null;
        }

        return data?.team_paths || null;
    } catch (error) {
        logError('fetchGameLocationHistory', error);
        return null;
    }
};

// --- TEAMS ---
// Members may be stored as JSON strings in a text[] column — parse them
const parseMembers = (raw: any): TeamMemberData[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((m: any) => {
        if (typeof m === 'string') {
            try { return JSON.parse(m); } catch { return { name: '', deviceId: '' }; }
        }
        return m;
    });
};

// Track whether optional team columns exist to avoid repeated fallbacks
let _teamColumnsExist: boolean | null = null;

export const fetchTeams = async (gameId: string): Promise<Team[]> => {
    try {
        let rows;

        // First attempt: try with optional columns (unless we already know they don't exist)
        if (_teamColumnsExist !== false) {
            const { data, error } = await supabase.from('teams')
                .select('id, game_id, name, join_code, photo_url, members, score, updated_at, captain_device_id, is_started, completed_point_ids, color, short_code, created_at')
                .eq('game_id', gameId);
            if (!error) {
                _teamColumnsExist = true;
                rows = data || [];
            } else {
                console.warn('[DB] fetchTeams: optional columns failed, using fallback:', error.message);
                _teamColumnsExist = false;
            }
        }

        // Fallback: fetch without optional columns
        if (!rows) {
            rows = await fetchInChunks(
                (offset, limit) => supabase.from('teams').select('id, game_id, name, join_code, photo_url, members, score, updated_at, captain_device_id, is_started, completed_point_ids').eq('game_id', gameId).range(offset, offset + limit - 1),
                `fetchTeams(${gameId})`,
                CHUNK_SIZE
            );
        }
        const data = rows;
        if (!data) return [];
        return data.map((row: any) => ({
            id: row.id,
            gameId: row.game_id,
            name: row.name,
            joinCode: row.join_code,
            photoUrl: row.photo_url,
            members: parseMembers(row.members),
            score: row.score,
            updatedAt: row.updated_at,
            captainDeviceId: row.captain_device_id,
            isStarted: row.is_started,
            completedPointIds: row.completed_point_ids || [],
            color: row.color || undefined,
            shortCode: row.short_code || undefined,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined
        }));
    } catch (e) {
        logError('fetchTeams', e);
        return [];
    }
};

export const fetchTeam = async (teamId: string): Promise<Team | null> => {
    try {
        let data: any;
        let error: any;

        if (_teamColumnsExist !== false) {
            ({ data, error } = await supabase.from('teams').select('id, game_id, name, join_code, photo_url, members, score, updated_at, captain_device_id, is_started, completed_point_ids, color, short_code, created_at').eq('id', teamId).single());
            if (error && !error.message?.includes('not found')) {
                _teamColumnsExist = false;
                data = null;
                error = null;
            }
        }

        if (!data && _teamColumnsExist === false) {
            ({ data, error } = await supabase.from('teams').select('id, game_id, name, join_code, photo_url, members, score, updated_at, captain_device_id, is_started, completed_point_ids').eq('id', teamId).single());
        }
        if (error) throw error;
        if (!data) return null;
        return {
            id: data.id,
            gameId: data.game_id,
            name: data.name,
            joinCode: data.join_code,
            photoUrl: data.photo_url,
            members: parseMembers(data.members),
            score: data.score,
            updatedAt: data.updated_at,
            captainDeviceId: data.captain_device_id,
            isStarted: data.is_started,
            completedPointIds: data.completed_point_ids || [],
            color: data.color || undefined,
            shortCode: data.short_code || undefined,
            createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined
        };
    } catch (e) {
        logError('fetchTeam', e);
        return null;
    }
};

export const isTeamNameTaken = async (gameId: string, teamName: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('teams')
            .select('id')
            .eq('game_id', gameId)
            .ilike('name', teamName);
        if (error) return true; // Assume taken on error to be safe
        return (data?.length || 0) > 0;
    } catch {
        return true;
    }
};

export const isPlayerNameTaken = async (gameId: string, playerName: string): Promise<boolean> => {
    if (!playerName) return false; // Empty names are not considered taken
    try {
        const allTeams = await fetchTeams(gameId);
        return allTeams.some(t =>
            t.members.some(m => m.name && m.name.toLowerCase() === playerName.toLowerCase())
        );
    } catch {
        return true; // Assume taken on error to be safe
    }
};

export const registerTeam = async (team: Team) => {
    try {
        // Check for duplicate team name in this game
        const taken = await isTeamNameTaken(team.gameId, team.name);
        if (taken) {
            throw new Error(`Team name "${team.name}" is already taken in this game`);
        }

        // Check for duplicate player names across all teams in this game (skip empty names)
        const existingTeams = await fetchTeams(team.gameId);
        const existingPlayerNames = new Set(
            existingTeams.flatMap(t => t.members.map(m => (m.name || '').toLowerCase()).filter(n => n))
        );
        const dupeNames = team.members.filter(m => m.name && existingPlayerNames.has(m.name.toLowerCase()));
        if (dupeNames.length > 0) {
            throw new Error(`Player name(s) already taken: ${dupeNames.map(m => m.name).join(', ')}`);
        }

        const insertData: any = {
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
        };
        // Only include optional columns if we know they exist
        if (_teamColumnsExist !== false) {
            if (team.color) insertData.color = team.color;
            if (team.shortCode) insertData.short_code = team.shortCode;
        }

        let { error } = await supabase.from('teams').insert(insertData);

        // If insert fails and we included optional columns, retry without them
        if (error && (insertData.color !== undefined || insertData.short_code !== undefined)) {
            console.warn('[DB] Retrying registerTeam without optional columns:', error.message);
            _teamColumnsExist = false;
            delete insertData.color;
            delete insertData.short_code;
            const retry = await supabase.from('teams').insert(insertData);
            error = retry.error;
        }

        if (error) throw error;
    } catch (e) { logError('registerTeam', e); }
};

export const updateTeam = async (teamId: string, updates: Partial<Team>) => {
    try {
        const payload: any = {};

        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.joinCode !== undefined) payload.join_code = updates.joinCode;
        if (updates.photoUrl !== undefined) payload.photo_url = updates.photoUrl;
        if (updates.members !== undefined) payload.members = updates.members;
        if (updates.score !== undefined) payload.score = updates.score;
        if (updates.captainDeviceId !== undefined) payload.captain_device_id = updates.captainDeviceId;
        if (updates.isStarted !== undefined) payload.is_started = updates.isStarted;
        if (updates.completedPointIds !== undefined) payload.completed_point_ids = updates.completedPointIds;
        if (_teamColumnsExist !== false) {
            if (updates.color !== undefined) payload.color = updates.color;
            if (updates.shortCode !== undefined) payload.short_code = updates.shortCode;
        }

        payload.updated_at = updates.updatedAt || new Date().toISOString();

        const { error } = await supabase.from('teams').update(payload).eq('id', teamId);
        if (error) throw error;
    } catch (e) {
        logError('updateTeam', e);
    }
};

// ATOMIC UPDATE (Fixes Race Condition Point 5)
export const updateTeamScore = async (teamId: string, delta: number) => {
    try {
        // Attempt to use RPC for atomic increment with retry logic
        await retryWithBackoff(
            () => supabase.rpc('increment_score', { team_id: teamId, amount: delta }).then(result => {
                if (result.error) throw result.error;
                return result;
            }),
            'updateTeamScore (RPC)'
        ).catch(async (e) => {
            // Fallback to legacy read-modify-write if RPC fails
            console.warn("RPC increment_score failed, falling back to standard update:", e.message);
            const team = await fetchTeam(teamId);
            if (team) {
                const newScore = Math.max(0, team.score + delta);
                await retryWithBackoff(
                    () => supabase.from('teams').update({ score: newScore }).eq('id', teamId).then(result => {
                        if (result.error) throw result.error;
                        return result;
                    }),
                    'updateTeamScore (fallback)'
                );
            }
        });
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
                await retryWithBackoff(
                    () => supabase.from('teams').update({
                        score: newScore, // Caller should calculate score, OR we use RPC logic separately
                        completed_point_ids: Array.from(completed)
                    }).eq('id', teamId).then(result => {
                        if (result.error) throw result.error;
                        return result;
                    }),
                    'updateTeamProgress'
                );
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

export const setMemberDisabled = async (teamId: string, memberDeviceId: string, isDisabled: boolean) => {
    try {
        const team = await fetchTeam(teamId);
        if (!team) return;
        const updatedMembers = team.members.map(m =>
            m.deviceId === memberDeviceId ? { ...m, isDisabled } : m
        );
        await supabase.from('teams').update({
            members: updatedMembers.map(m => JSON.stringify(m)),
            updated_at: new Date().toISOString()
        }).eq('id', teamId);
    } catch (e) { logError('setMemberDisabled', e); }
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

export const fetchTeamByShortCode = async (gameId: string, shortCode: string): Promise<Team | null> => {
    try {
        const { data, error } = await supabase
            .from('teams')
            .select('id, game_id, name, join_code, photo_url, members, score, updated_at, captain_device_id, is_started, completed_point_ids, color, short_code, created_at')
            .eq('game_id', gameId)
            .eq('short_code', shortCode.toUpperCase())
            .single();
        if (error || !data) return null;
        return {
            id: data.id,
            gameId: data.game_id,
            name: data.name,
            joinCode: data.join_code,
            photoUrl: data.photo_url,
            members: parseMembers(data.members),
            score: data.score,
            updatedAt: data.updated_at,
            captainDeviceId: data.captain_device_id,
            isStarted: data.is_started,
            completedPointIds: data.completed_point_ids || [],
            color: data.color || undefined,
            shortCode: data.short_code || undefined,
            createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined
        };
    } catch (e) {
        logError('fetchTeamByShortCode', e);
        return null;
    }
};

export const removeTeamMember = async (teamId: string, deviceId: string): Promise<void> => {
    try {
        const team = await fetchTeam(teamId);
        if (!team) return;

        const updatedMembers = team.members.filter(m => m.deviceId !== deviceId);

        // If captain was removed, promote first remaining member
        let captainId = team.captainDeviceId;
        if (captainId === deviceId && updatedMembers.length > 0) {
            captainId = updatedMembers[0].deviceId;
        }

        await supabase.from('teams').update({
            members: updatedMembers.map(m => JSON.stringify(m)),
            captain_device_id: captainId,
            updated_at: new Date().toISOString()
        }).eq('id', teamId);
    } catch (e) {
        logError('removeTeamMember', e);
    }
};

export const addTeamMember = async (teamId: string, member: { deviceId: string; name: string; photo?: string }): Promise<void> => {
    try {
        const team = await fetchTeam(teamId);
        if (!team) return;

        // Don't add if already a member
        if (team.members.some(m => m.deviceId === member.deviceId)) return;

        const updatedMembers = [...team.members, member];

        await supabase.from('teams').update({
            members: updatedMembers.map(m => JSON.stringify(m)),
            updated_at: new Date().toISOString()
        }).eq('id', teamId);
    } catch (e) {
        logError('addTeamMember', e);
    }
};

// --- LIBRARY & LISTS ---
export const fetchLibrary = async (): Promise<TaskTemplate[]> => {
    const normalizeTemplate = (template: any): TaskTemplate => {
        return {
            ...template,
            tags: Array.isArray(template.tags) ? template.tags : []
        };
    };

    try {
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('library').select('id, data').range(offset, offset + limit - 1),
            'fetchLibrary',
            LIBRARY_CHUNK_SIZE,
            LIBRARY_FETCH_TIMEOUT_MS
        );
        return rows.map((row: any) => {
            // Handle both direct data objects and stringified JSON
            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            return normalizeTemplate({ ...rowData, id: row.id });
        });
    } catch (e: any) {
        logError('fetchLibrary', e);
        console.warn('[DB Service] Initial fetch failed for fetchLibrary. Trying lightweight fallback...');

        // Try fallback 1: fetch just IDs without data (very fast)
        try {
            console.warn('[DB Service] Fallback 1: Fetching 10 most recent items (IDs only)...');
            const { data, error } = await Promise.race([
                supabase.from('library').select('id, data').limit(10).order('created_at', { ascending: false }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Fallback 1 timeout')), 8000)
                )
            ]);

            if (error) throw error;
            if (data && data.length > 0) {
                console.log(`[DB Service] ✅ Fallback 1 successful - returned ${data.length} items`);
                return data.map((row: any) => {
                    const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                    return normalizeTemplate({ ...rowData, id: row.id });
                });
            }
        } catch (fallback1Error: any) {
            console.warn(`[DB Service] Fallback 1 failed: ${fallback1Error?.message}`);
        }

        // Try fallback 2: Just return empty - better UX than hanging
        console.warn('[DB Service] ⚠️  All library fetch attempts failed.');
        console.warn('[DB Service] Possible causes:');
        console.warn('[DB Service]   1. Supabase project is PAUSED (free tier) - visit https://supabase.com/dashboard');
        console.warn('[DB Service]   2. Database connection is too slow or unreachable');
        console.warn('[DB Service]   3. Network timeout - check your internet connection');
        console.warn('[DB Service] Application will continue with demo content.');
        return [];
    }
};

const VALID_TEMPLATE_LANGUAGES = ['English', 'Danish', 'German', 'Spanish', 'French', 'Swedish', 'Norwegian', 'Dutch', 'Belgian', 'Hebrew'];

const normalizeTemplateForSave = (template: TaskTemplate): TaskTemplate => {
    // Respect user's language choice if explicitly set, otherwise auto-detect
    const hasValidLanguage = template.settings?.language && VALID_TEMPLATE_LANGUAGES.includes(template.settings.language);

    const finalLanguage = hasValidLanguage
        ? template.settings!.language
        : detectLanguageFromText(template.task.question || '');

    return {
        ...template,
        tags: Array.isArray(template.tags) ? template.tags : [],
        settings: {
            ...template.settings,
            language: finalLanguage
        }
    };
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
};

export const saveTemplates = async (
    templates: TaskTemplate[],
    opts?: { chunkSize?: number; onProgress?: (info: { completed: number; total: number }) => void }
): Promise<{ ok: boolean }> => {
    try {
        if (!templates || templates.length === 0) return { ok: true };

        // Many parallel upserts can overwhelm Postgres and trigger statement_timeout (57014).
        // We chunk + save sequentially to keep each statement small and predictable.
        const chunkSize = Math.max(1, Math.min(opts?.chunkSize ?? 10, 50));
        const updatedAt = new Date().toISOString();

        const normalized = templates.map(normalizeTemplateForSave);
        const chunks = chunkArray(normalized, chunkSize);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            opts?.onProgress?.({ completed: i, total: chunks.length });

            await retryWithBackoff(
                () =>
                    supabase
                        .from('library')
                        .upsert(
                            chunk.map(t => ({ id: t.id, data: t, updated_at: updatedAt })),
                            { onConflict: 'id' }
                        )
                        .then(result => {
                            if (result.error) throw result.error;
                            return result;
                        }),
                `saveTemplates[chunk=${i + 1}/${chunks.length}]`
            );
        }

        opts?.onProgress?.({ completed: chunks.length, total: chunks.length });

        return { ok: true };
    } catch (e) {
        logError('saveTemplates', e);
        return { ok: false };
    }
};

export const saveTemplate = async (template: TaskTemplate): Promise<{ ok: boolean }> => {
    const { ok } = await saveTemplates([template]);
    if (!ok) {
        // Keep existing behavior (log + don't throw), but ensure saveTemplate logs show up.
        console.warn('[DB Service] saveTemplate failed (see previous error for details)');
    }
    return { ok };
};

export const deleteTemplate = async (id: string) => {
    try { await supabase.from('library').delete().eq('id', id); } catch (e) { logError('deleteTemplate', e); }
};

/**
 * Syncs task data from the global library to game points or playzone template tasks.
 * This ensures that edits made in the library are reflected in games/playzones.
 *
 * @param tasks - Array of GamePoint tasks to sync
 * @returns Updated tasks with library data merged in
 */
export const syncTasksFromLibrary = async (tasks: GamePoint[]): Promise<{ tasks: GamePoint[]; syncedCount: number }> => {
    try {
        // Fetch all library tasks
        const libraryTasks = await fetchLibrary();

        // Create a map for quick lookup by ID
        const libraryMap = new Map(libraryTasks.map(t => [t.id, t]));

        let syncedCount = 0;

        // Update tasks with library data if available
        const updatedTasks = tasks.map(task => {
            const libraryTask = libraryMap.get(task.id);

            if (!libraryTask) {
                // No matching library task - keep as is
                return task;
            }

            // Merge library data into the task, preserving game-specific fields
            syncedCount++;

            return {
                ...task,
                // Update from library
                title: libraryTask.title,
                task: libraryTask.task,
                shortIntro: (libraryTask as any).intro || task.shortIntro,
                iconId: libraryTask.iconId || task.iconId,
                iconUrl: (libraryTask as any).iconUrl || task.iconUrl,
                points: libraryTask.points ?? task.points,
                tags: libraryTask.tags || task.tags,
                feedback: libraryTask.feedback || task.feedback,
                settings: libraryTask.settings || task.settings,
                logic: libraryTask.logic || task.logic,
                completionLogic: (libraryTask as any).completionLogic || task.completionLogic,
                activationTypes: libraryTask.activationTypes || task.activationTypes,
                // Preserve game-specific fields
                location: task.location,
                radiusMeters: task.radiusMeters,
                playgroundId: task.playgroundId,
                devicePositions: task.devicePositions,
                playgroundScale: task.playgroundScale,
                isHiddenBeforeScan: task.isHiddenBeforeScan,
                areaColor: task.areaColor,
                openingAudioUrl: task.openingAudioUrl,
                isUnlocked: task.isUnlocked,
                isCompleted: task.isCompleted,
                order: task.order,
                manualUnlockCode: task.manualUnlockCode,
                colorScheme: task.colorScheme,
                isColorSchemeLocked: task.isColorSchemeLocked
            };
        });

        console.log(`[DB Service] ✅ Synced ${syncedCount} tasks from library`);

        return { tasks: updatedTasks, syncedCount };
    } catch (e) {
        logError('syncTasksFromLibrary', e);
        // Return original tasks on error
        return { tasks, syncedCount: 0 };
    }
};

export const fetchTaskLists = async (): Promise<TaskList[]> => {
    try {
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('task_lists').select('id, data').range(offset, offset + limit - 1),
            'fetchTaskLists',
            CHUNK_SIZE,
            FETCH_TIMEOUT_MS
        );
        return rows.map((row: any) => {
            const rowData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            return { ...rowData, id: row.id };
        });
    } catch (e) {
        logError('fetchTaskLists', e);
        // Try fallback: fetch a smaller batch without chunking as last resort
        try {
            console.warn('[DB Service] Attempting fetchTaskLists fallback (small batch)...');
            const { data, error } = await Promise.race([
                supabase.from('task_lists').select('id, data').limit(200).order('id', { ascending: false }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Fallback query timeout after 10s')), 10000)
                )
            ]);

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

const VALID_TASKLIST_LANGUAGES = ['English', 'Danish', 'German', 'Spanish', 'French', 'Swedish', 'Norwegian', 'Dutch', 'Belgian', 'Hebrew'];

const normalizeTaskListForSave = (list: TaskList): TaskList => {
    return {
        ...list,
        tasks: list.tasks.map(task => {
            const hasValidLanguage = task.settings?.language && VALID_TASKLIST_LANGUAGES.includes(task.settings.language);
            const finalLanguage = hasValidLanguage
                ? task.settings.language
                : detectLanguageFromText(task.task.question || '');

            return {
                ...task,
                settings: {
                    ...task.settings,
                    language: finalLanguage
                }
            };
        })
    };
};

export const saveTaskLists = async (
    lists: TaskList[],
    opts?: { chunkSize?: number; onProgress?: (info: { completed: number; total: number }) => void }
): Promise<{ ok: boolean }> => {
    try {
        if (!lists || lists.length === 0) return { ok: true };

        const chunkSize = Math.max(1, Math.min(opts?.chunkSize ?? 10, 50));
        const updatedAt = new Date().toISOString();

        const normalized = lists.map(normalizeTaskListForSave);
        const chunks = chunkArray(normalized, chunkSize);

        const total = normalized.length;

        for (let i = 0; i < chunks.length; i++) {
            const completedBeforeChunk = Math.min(i * chunkSize, total);
            opts?.onProgress?.({ completed: completedBeforeChunk, total });

            const chunk = chunks[i];

            await retryWithBackoff(
                () =>
                    supabase
                        .from('task_lists')
                        .upsert(
                            chunk.map(list => ({ id: list.id, data: list, updated_at: updatedAt })),
                            { onConflict: 'id' }
                        )
                        .then(result => {
                            if (result.error) throw result.error;
                            return result;
                        }),
                `saveTaskLists[chunk=${i + 1}/${chunks.length}]`
            );
        }

        opts?.onProgress?.({ completed: total, total });

        return { ok: true };
    } catch (e) {
        logError('saveTaskLists', e);
        return { ok: false };
    }
};

export const saveTaskList = async (list: TaskList) => {
    try {
        const normalizedList = normalizeTaskListForSave(list);

        await retryWithBackoff(
            () =>
                supabase
                    .from('task_lists')
                    .upsert({
                        id: normalizedList.id,
                        data: normalizedList,
                        updated_at: new Date().toISOString()
                    })
                    .then(result => {
                        if (result.error) {
                            throw result.error;
                        }
                        return result;
                    }),
            'saveTaskList'
        );
    } catch (e) {
        logError('saveTaskList', e);
        throw e; // Re-throw so caller can handle it
    }
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
            CHUNK_SIZE,
            FETCH_TIMEOUT_MS
        );

        const templates = rows.map((row: any) => {
            const template = { ...row.data, id: row.id, title: row.title, isGlobal: row.is_global };

            // CRITICAL: Validate template structure AND position data
            if (!template.tasks) {
                console.warn('[DB] ⚠️ Template loaded WITHOUT TASKS:', {
                    id: template.id,
                    title: template.title,
                    dataKeys: Object.keys(row.data || {}),
                    fullData: row.data
                });
            } else {
                const tasksWithPositions = template.tasks.filter((t: any) => t.playgroundPosition || t.devicePositions);
                const sampleTask = template.tasks[0];

                console.log('[DB] 📦 Template loaded:', {
                    id: template.id,
                    title: template.title,
                    taskCount: template.tasks.length,
                    tasksWithPositions: tasksWithPositions.length,
                    positionCoverage: `${Math.round((tasksWithPositions.length / template.tasks.length) * 100)}%`,
                    playgroundDataPresent: !!template.playgroundData,
                    sampleTaskPositions: sampleTask ? {
                        hasPlaygroundPosition: !!(sampleTask as any).playgroundPosition,
                        playgroundPosition: (sampleTask as any).playgroundPosition,
                        hasDevicePositions: !!(sampleTask as any).devicePositions,
                        devicePositions: (sampleTask as any).devicePositions
                    } : null
                });

                if (tasksWithPositions.length === 0) {
                    console.warn('[DB] ⚠️ Template has NO position data:', {
                        id: template.id,
                        title: template.title,
                        message: 'Tasks will use default grid layout when imported'
                    });
                }
            }

            return template;
        });

        console.log('[DB] fetchPlaygroundLibrary completed:', {
            totalTemplates: templates.length,
            withTasks: templates.filter(t => t.tasks && t.tasks.length > 0).length,
            withoutTasks: templates.filter(t => !t.tasks || t.tasks.length === 0).length
        });

        return templates;
    } catch (e) {
        logError('fetchPlaygroundLibrary', e);
        console.error('[DB] fetchPlaygroundLibrary error details:', e);
        return [];
    }
};

export const savePlaygroundTemplate = async (template: PlaygroundTemplate) => {
    try {
        // CRITICAL: Validate template has tasks AND position data before saving
        const tasksWithPositions = template.tasks?.filter((t: any) => t.playgroundPosition || t.devicePositions) || [];
        const sampleTask = template.tasks?.[0];

        console.log('[DB] 💾 savePlaygroundTemplate - FULL VALIDATION:', {
            id: template.id,
            title: template.title,
            hasPlaygroundData: !!template.playgroundData,
            hasTasks: !!template.tasks,
            taskCount: template.tasks?.length || 0,
            tasksWithPositionData: tasksWithPositions.length,
            positionDataPercentage: template.tasks?.length ? `${Math.round((tasksWithPositions.length / template.tasks.length) * 100)}%` : '0%',
            sampleTask: sampleTask ? {
                id: sampleTask.id,
                title: sampleTask.title,
                hasPlaygroundPosition: !!(sampleTask as any).playgroundPosition,
                playgroundPosition: (sampleTask as any).playgroundPosition,
                hasDevicePositions: !!(sampleTask as any).devicePositions,
                devicePositions: (sampleTask as any).devicePositions,
                allKeys: Object.keys(sampleTask)
            } : null
        });

        if (!template.tasks || template.tasks.length === 0) {
            console.error('[DB] ⚠️ WARNING: Attempting to save template WITHOUT TASKS!', {
                id: template.id,
                title: template.title,
                templateKeys: Object.keys(template)
            });
        }

        if (tasksWithPositions.length === 0 && template.tasks && template.tasks.length > 0) {
            console.warn('[DB] ⚠️ WARNING: Template tasks have NO POSITION DATA!', {
                id: template.id,
                title: template.title,
                taskCount: template.tasks.length,
                message: 'Tasks will be placed in default grid when imported'
            });
        }

        const result = await retryWithBackoff(
            () => supabase.from('playground_library').upsert({
                id: template.id,
                title: template.title,
                is_global: template.isGlobal,
                data: template,
                updated_at: new Date().toISOString()
            }).then(result => {
                if (result.error) throw result.error;
                return result;
            }),
            'savePlaygroundTemplate'
        );

        console.log('[DB] savePlaygroundTemplate - SUCCESS:', {
            id: template.id,
            title: template.title,
            tasksIncluded: template.tasks?.length || 0
        });

        return result;
    } catch (e) {
        console.error('[DB] savePlaygroundTemplate - ERROR:', {
            error: e,
            template: { id: template.id, title: template.title }
        });
        logError('savePlaygroundTemplate', e);
    }
};

export const deletePlaygroundTemplate = async (id: string) => {
    try { await supabase.from('playground_library').delete().eq('id', id); } catch (e) { logError('deletePlaygroundTemplate', e); }
};

/**
 * Validates playground templates and logs diagnostic information
 * Use this to identify broken templates (missing tasks)
 */
export const validatePlaygroundTemplates = async (): Promise<{
    total: number;
    valid: number;
    broken: number;
    brokenTemplates: Array<{ id: string; title: string; issue: string }>;
}> => {
    try {
        console.log('[DB] Starting template validation...');

        const templates = await fetchPlaygroundLibrary();

        const broken: Array<{ id: string; title: string; issue: string }> = [];

        templates.forEach((template: PlaygroundTemplate) => {
            if (!template.tasks) {
                broken.push({
                    id: template.id,
                    title: template.title,
                    issue: 'Missing tasks array'
                });
            } else if (template.tasks.length === 0) {
                broken.push({
                    id: template.id,
                    title: template.title,
                    issue: 'Empty tasks array'
                });
            } else if (!template.playgroundData) {
                broken.push({
                    id: template.id,
                    title: template.title,
                    issue: 'Missing playgroundData'
                });
            }
        });

        const result = {
            total: templates.length,
            valid: templates.length - broken.length,
            broken: broken.length,
            brokenTemplates: broken
        };

        console.log('[DB] Template validation complete:', result);

        if (broken.length > 0) {
            console.warn('[DB] Found broken templates that should be deleted:', broken);
        }

        return result;
    } catch (error) {
        console.error('[DB] Template validation error:', error);
        throw error;
    }
};

// --- USERS ---
export const fetchAccountUsers = async (): Promise<AccountUser[]> => {
    try {
        const rows = await fetchInChunks(
            (offset, limit) => supabase.from('account_users').select('id, data').range(offset, offset + limit - 1),
            'fetchAccountUsers',
            CHUNK_SIZE,
            FETCH_TIMEOUT_MS
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

// --- USER SETTINGS ---
const SYSTEM_SETTINGS_USER_ID = '00000000-0000-0000-0000-000000000000';

type TagColorsMap = Record<string, string>;

// Cache system settings in localStorage to avoid 406 network errors on every page load
const SYSTEM_SETTINGS_CACHE_KEY = 'system_settings_cache';
const SYSTEM_SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const fetchSystemSettings = async (): Promise<any | null> => {
    // Try cache first to avoid network 406 errors showing in console
    try {
        const cached = localStorage.getItem(SYSTEM_SETTINGS_CACHE_KEY);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < SYSTEM_SETTINGS_CACHE_TTL) {
                return data;
            }
        }
    } catch { /* ignore cache errors */ }

    const result = await fetchUserSettings(SYSTEM_SETTINGS_USER_ID);

    // Cache the result (even null) to prevent repeated failing requests
    try {
        localStorage.setItem(SYSTEM_SETTINGS_CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
    } catch { /* ignore cache write errors */ }

    return result;
};

export const saveSystemSettings = async (patch: any): Promise<boolean> => {
    const current = (await fetchSystemSettings()) || {};
    return saveUserSettings(SYSTEM_SETTINGS_USER_ID, { ...current, ...patch });
};

export const fetchTagColors = async (): Promise<TagColorsMap> => {
    try {
        const settings = await fetchSystemSettings();
        const fromDb = settings?.tagColors;
        if (fromDb && typeof fromDb === 'object') return fromDb as TagColorsMap;
        return {};
    } catch (e) {
        logError('fetchTagColors', e);
        return {};
    }
};

export const saveTagColors = async (tagColors: TagColorsMap): Promise<boolean> => {
    try {
        return await saveSystemSettings({ tagColors });
    } catch (e) {
        logError('saveTagColors', e);
        return false;
    }
};
export const fetchUserSettings = async (userId: string): Promise<any | null> => {
    try {
        // Use maybeSingle() instead of single() to avoid 406 network errors
        // when no row exists (single() throws 406, maybeSingle() returns null)
        const { data, error } = await supabase
            .from('user_settings')
            .select('data')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            // No row found - return null (not an error)
            if (error.code === 'PGRST116') {
                return null;
            }

            // 406 Not Acceptable - PostgREST content-type negotiation issue, treat as no data
            if (error.code === 'PGRST106' || `${error.message || ''}`.includes('406')) {
                console.debug(`[DB Service] fetchUserSettings: 406 response (user_id: ${userId}), treating as no data`);
                return null;
            }

            // If DB uses UUID user_id but we pass a non-uuid, Postgres returns 22P02.
            if (error.code === '22P02' || `${error.message || ''}`.includes('invalid input syntax for type uuid')) {
                console.debug(`[DB Service] fetchUserSettings skipped (user_id not uuid in this schema): ${userId}`);
                return null;
            }

            // RLS policy violation (42501) - user doesn't have permission to read this row
            // This is expected for system-wide settings when using a non-user UUID
            if (error.code === '42501' || `${error.message || ''}`.includes('row-level security policy')) {
                console.debug(`[DB Service] fetchUserSettings blocked by RLS policy (expected for system settings with user_id: ${userId})`);
                return null; // Return null to allow app to continue with defaults
            }

            throw error;
        }

        return data?.data || null;
    } catch (e: any) {
        // If DB uses UUID user_id but we pass a non-uuid, Postgres returns 22P02.
        if (e?.code === '22P02' || `${e?.message || ''}`.includes('invalid input syntax for type uuid')) {
            console.debug(`[DB Service] fetchUserSettings skipped (user_id not uuid in this schema): ${userId}`);
            return null;
        }

        // RLS policy violation (42501) - user doesn't have permission to read this row
        if (e?.code === '42501' || `${e?.message || ''}`.includes('row-level security policy')) {
            console.debug(`[DB Service] fetchUserSettings blocked by RLS policy (user_id: ${userId})`);
            return null;
        }

        logError('fetchUserSettings', e);
        return null;
    }
};

export const saveUserSettings = async (userId: string, settings: any): Promise<boolean> => {
    try {
        await retryWithBackoff(
            () => supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    data: settings,
                    updated_at: new Date().toISOString()
                }).then(result => {
                    if (result.error) throw result.error;
                    return result;
                }),
            'saveUserSettings'
        );
        return true;
    } catch (e: any) {
        // If DB uses UUID user_id but we pass a non-uuid, Postgres returns 22P02.
        if (e?.code === '22P02' || `${e?.message || ''}`.includes('invalid input syntax for type uuid')) {
            console.debug(`[DB Service] saveUserSettings skipped (user_id not uuid in this schema): ${userId}`);
            return true; // treat as success to prevent cascading UI errors
        }

        // RLS policy violation (42501) - user doesn't have permission to write this row
        // This is expected for system-wide settings when using a non-user UUID
        if (e?.code === '42501' || `${e?.message || ''}`.includes('row-level security policy')) {
            console.debug(`[DB Service] saveUserSettings blocked by RLS policy (expected for system settings with user_id: ${userId})`);
            return true; // Treat as success to prevent cascading UI errors - system can function without persisting settings
        }

        logError('saveUserSettings', e);
        return false;
    }
};

// --- GAME STATISTICS ---
export const saveGameStats = async (statsData: any): Promise<boolean> => {
    try {
        await retryWithBackoff(
            () => supabase
                .from('game_statistics')
                .insert({
                    game_id: statsData.gameId,
                    game_name: statsData.gameName,
                    timestamp: statsData.timestamp,
                    teams_data: statsData.teams,
                    total_stats: statsData.totalStats
                }).then(result => {
                    // If table doesn't exist, log a warning and continue
                    if (result.error?.code === '42P01') {
                        console.warn('[DB Service] game_statistics table not found. Stats will be saved locally only.');
                        return result;
                    }
                    if (result.error) throw result.error;
                    return result;
                }),
            'saveGameStats'
        );

        console.log('[DB Service] Game statistics saved successfully');
        return true;
    } catch (e) {
        logError('saveGameStats', e);
        return false;
    }
};

// --- QR CODE MANAGEMENT ---
export const checkQRCodeDuplicate = async (qrCodeString: string, gameId: string, excludePointId?: string): Promise<boolean> => {
    try {
        const game = await fetchGame(gameId);
        if (!game) return false;

        // Check if any other point in the game has the same QR code
        const isDuplicate = game.points.some(point =>
            point.qrCodeString === qrCodeString &&
            (!excludePointId || point.id !== excludePointId)
        );

        return isDuplicate;
    } catch (e) {
        logError('checkQRCodeDuplicate', e);
        return false;
    }
};

// --- MAP STYLES ---
export const fetchCustomMapStyles = async (): Promise<Array<{id: string; name: string; json: string; previewUrl?: string}>> => {
    try {
        const { data, error } = await supabase
            .from('map_styles')
            .select('id, name, json, preview_url')
            .order('created_at', { ascending: false });

        if (error) {
            if (error.code === '42P01') {
                // Table doesn't exist yet
                console.warn('[DB Service] map_styles table not found');
                return [];
            }
            throw error;
        }

        // Transform preview_url to previewUrl for consistency
        return (data || []).map(style => ({
            id: style.id,
            name: style.name,
            json: style.json,
            previewUrl: style.preview_url
        }));
    } catch (e) {
        logError('fetchCustomMapStyles', e);
        return [];
    }
};

export const saveCustomMapStyle = async (style: {id?: string; name: string; json: string; previewUrl?: string}): Promise<{id: string; name: string; json: string; previewUrl?: string} | null> => {
    try {
        if (style.id) {
            // Update existing style
            const { error } = await supabase
                .from('map_styles')
                .update({
                    name: style.name,
                    json: style.json,
                    preview_url: style.previewUrl || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', style.id);

            if (error) throw error;

            return {
                id: style.id,
                name: style.name,
                json: style.json,
                previewUrl: style.previewUrl
            };
        } else {
            // Create new style
            const newId = `map-style-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const { error } = await supabase
                .from('map_styles')
                .insert({
                    id: newId,
                    name: style.name,
                    json: style.json,
                    preview_url: style.previewUrl || null,
                    created_by: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            return {
                id: newId,
                name: style.name,
                json: style.json,
                previewUrl: style.previewUrl
            };
        }
    } catch (e) {
        logError('saveCustomMapStyle', e);
        return null;
    }
};

export const deleteCustomMapStyle = async (styleId: string): Promise<boolean> => {
    try {
        // First check if this style is being used in any games
        const gamesUsingStyle = await countMapStyleUsage('google_custom');

        if (gamesUsingStyle > 0) {
            // Replace with OSM style in all games using google_custom
            await replaceMapStyleInGames('google_custom', 'osm');
        }

        const { error } = await supabase
            .from('map_styles')
            .delete()
            .eq('id', styleId);

        if (error) throw error;
        return true;
    } catch (e) {
        logError('deleteCustomMapStyle', e);
        return false;
    }
};

// --- MEDIA SUBMISSIONS (Live Approval) ---
export const getMediaSubmissions = async (gameId: string): Promise<MediaSubmission[]> => {
    try {
        const { data, error } = await supabase
            .from('media_submissions')
            .select('*')
            .eq('game_id', gameId)
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        // Transform snake_case to camelCase
        return (data || []).map(item => ({
            id: item.id,
            gameId: item.game_id,
            teamId: item.team_id,
            teamName: item.team_name,
            pointId: item.point_id,
            pointTitle: item.point_title,
            mediaUrl: item.media_url,
            mediaType: item.media_type,
            submittedAt: item.submitted_at,
            status: item.status,
            reviewedBy: item.reviewed_by,
            reviewedAt: item.reviewed_at,
            reviewComment: item.review_comment
        }));
    } catch (e) {
        logError('getMediaSubmissions', e);
        return [];
    }
};

export const submitMediaForReview = async (submission: Omit<MediaSubmission, 'id' | 'status' | 'submittedAt'>): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('media_submissions')
            .insert({
                game_id: submission.gameId,
                team_id: submission.teamId,
                team_name: submission.teamName,
                point_id: submission.pointId,
                point_title: submission.pointTitle,
                media_url: submission.mediaUrl,
                media_type: submission.mediaType,
                status: 'pending',
                submitted_at: Date.now()
            })
            .select('id')
            .single();

        if (error) throw error;
        return data?.id || null;
    } catch (e) {
        logError('submitMediaForReview', e);
        return null;
    }
};

export const approveMediaSubmission = async (submissionId: string, reviewerName: string, comment?: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('media_submissions')
            .update({
                status: 'approved',
                reviewed_by: reviewerName,
                reviewed_at: Date.now(),
                review_comment: comment || null
            })
            .eq('id', submissionId);

        if (error) throw error;
        return true;
    } catch (e) {
        logError('approveMediaSubmission', e);
        return false;
    }
};

export const rejectMediaSubmission = async (submissionId: string, reviewerName: string, comment: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('media_submissions')
            .update({
                status: 'rejected',
                reviewed_by: reviewerName,
                reviewed_at: Date.now(),
                review_comment: comment
            })
            .eq('id', submissionId);

        if (error) throw error;
        return true;
    } catch (e) {
        logError('rejectMediaSubmission', e);
        return false;
    }
};

// --- PLAYER RECOVERY CODES ---
// Allows players to reconnect on a new device after losing access (battery died, etc.)

export interface RecoveryCodeData {
    code: string;
    gameId: string;
    teamName: string;
    deviceId: string;
    userName: string;
    userPhoto?: string;
    createdAt: number;
    expiresAt: number;
}

// Generate a 6-character alphanumeric recovery code
const generateRecoveryCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous: 0, O, 1, I
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

export const createRecoveryCode = async (
    gameId: string,
    teamName: string,
    deviceId: string,
    userName: string,
    userPhoto?: string
): Promise<string | null> => {
    try {
        const code = generateRecoveryCode();
        const now = Date.now();
        const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours

        const recoveryData: RecoveryCodeData = {
            code,
            gameId,
            teamName,
            deviceId,
            userName,
            userPhoto,
            createdAt: now,
            expiresAt
        };

        const { error } = await supabase
            .from('player_recovery_codes')
            .upsert({
                code,
                device_id: deviceId,
                game_id: gameId,
                data: recoveryData,
                expires_at: new Date(expiresAt).toISOString()
            });

        if (error) {
            // If table doesn't exist, fall back to localStorage
            if (error.code === '42P01') {
                console.warn('[DB Service] player_recovery_codes table not found. Using localStorage fallback.');
                localStorage.setItem(`recovery_code_${code}`, JSON.stringify(recoveryData));
                return code;
            }
            throw error;
        }

        // Also store locally as backup
        localStorage.setItem(`recovery_code_${code}`, JSON.stringify(recoveryData));

        return code;
    } catch (e) {
        logError('createRecoveryCode', e);
        return null;
    }
};

export const verifyRecoveryCode = async (code: string): Promise<RecoveryCodeData | null> => {
    try {
        // First try database
        const { data, error } = await supabase
            .from('player_recovery_codes')
            .select('data, expires_at')
            .eq('code', code.toUpperCase())
            .single();

        if (!error && data) {
            const expiresAt = new Date(data.expires_at).getTime();
            if (Date.now() > expiresAt) {
                console.warn('[Recovery] Code expired');
                return null;
            }
            return data.data as RecoveryCodeData;
        }

        // Fallback to localStorage
        const localData = localStorage.getItem(`recovery_code_${code.toUpperCase()}`);
        if (localData) {
            const recoveryData = JSON.parse(localData) as RecoveryCodeData;
            if (Date.now() > recoveryData.expiresAt) {
                localStorage.removeItem(`recovery_code_${code.toUpperCase()}`);
                console.warn('[Recovery] Local code expired');
                return null;
            }
            return recoveryData;
        }

        return null;
    } catch (e) {
        // If table doesn't exist, try localStorage only
        if ((e as any)?.code === '42P01') {
            const localData = localStorage.getItem(`recovery_code_${code.toUpperCase()}`);
            if (localData) {
                const recoveryData = JSON.parse(localData) as RecoveryCodeData;
                if (Date.now() > recoveryData.expiresAt) {
                    localStorage.removeItem(`recovery_code_${code.toUpperCase()}`);
                    return null;
                }
                return recoveryData;
            }
        }
        logError('verifyRecoveryCode', e);
        return null;
    }
};

export const deleteRecoveryCode = async (code: string): Promise<void> => {
    try {
        await supabase
            .from('player_recovery_codes')
            .delete()
            .eq('code', code.toUpperCase());
    } catch (e) {
        // Ignore errors - code cleanup is best-effort
    }
    localStorage.removeItem(`recovery_code_${code.toUpperCase()}`);
};
