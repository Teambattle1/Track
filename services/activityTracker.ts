import { supabase } from '../lib/supabase';

const LAST_LOGIN_KEY = 'last_login_timestamp';

/**
 * Get the last login timestamp from localStorage
 */
export const getLastLogin = (): number => {
  const lastLogin = localStorage.getItem(LAST_LOGIN_KEY);
  return lastLogin ? parseInt(lastLogin, 10) : 0;
};

/**
 * Update the last login timestamp to now
 */
export const updateLastLogin = (): void => {
  localStorage.setItem(LAST_LOGIN_KEY, Date.now().toString());
};

/**
 * Get count of pending media submissions for a specific game
 */
export const getPendingMediaCount = async (gameId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('media_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('status', 'pending');

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') return 0;
      console.error('[Activity] Failed to get pending count:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    return 0;
  }
};

/**
 * Get new activity since last login
 */
export interface ActivitySummary {
  newSubmissions: number;
  pendingApprovals: number;
  recentlyApproved: number;
  recentlyRejected: number;
  gameActivities: Array<{
    gameId: string;
    gameName: string;
    pendingCount: number;
    newSinceLogin: number;
  }>;
}

export const getActivitySinceLastLogin = async (
  games: Array<{ id: string; name: string }>,
  lastLogin: number
): Promise<ActivitySummary> => {
  try {
    // Get all submissions
    const { data: allSubmissions, error } = await supabase
      .from('media_submissions')
      .select('*')
      .in('game_id', games.map(g => g.id));

    if (error) {
      // Table doesn't exist yet
      if (error.code === '42P01' || error.code === '42703') {
        return {
          newSubmissions: 0,
          pendingApprovals: 0,
          recentlyApproved: 0,
          recentlyRejected: 0,
          gameActivities: []
        };
      }
      console.error('[Activity] Failed to get activity:', error);
      return {
        newSubmissions: 0,
        pendingApprovals: 0,
        recentlyApproved: 0,
        recentlyRejected: 0,
        gameActivities: []
      };
    }

    if (!allSubmissions) {
      return {
        newSubmissions: 0,
        pendingApprovals: 0,
        recentlyApproved: 0,
        recentlyRejected: 0,
        gameActivities: []
      };
    }

    // Count new submissions since last login
    const newSubmissions = allSubmissions.filter(s => s.submitted_at > lastLogin).length;
    
    // Count current pending approvals
    const pendingApprovals = allSubmissions.filter(s => s.status === 'pending').length;
    
    // Count recently approved (since last login)
    const recentlyApproved = allSubmissions.filter(
      s => s.status === 'approved' && s.reviewed_at && s.reviewed_at > lastLogin
    ).length;
    
    // Count recently rejected (since last login)
    const recentlyRejected = allSubmissions.filter(
      s => s.status === 'rejected' && s.reviewed_at && s.reviewed_at > lastLogin
    ).length;

    // Per-game activity
    const gameActivities = games.map(game => {
      const gameSubmissions = allSubmissions.filter(s => s.game_id === game.id);
      const pendingCount = gameSubmissions.filter(s => s.status === 'pending').length;
      const newSinceLogin = gameSubmissions.filter(s => s.submitted_at > lastLogin).length;

      return {
        gameId: game.id,
        gameName: game.name,
        pendingCount,
        newSinceLogin
      };
    }).filter(g => g.pendingCount > 0 || g.newSinceLogin > 0); // Only games with activity

    return {
      newSubmissions,
      pendingApprovals,
      recentlyApproved,
      recentlyRejected,
      gameActivities
    };
  } catch (error) {
    console.error('[Activity] Error:', error);
    return {
      newSubmissions: 0,
      pendingApprovals: 0,
      recentlyApproved: 0,
      recentlyRejected: 0,
      gameActivities: []
    };
  }
};

/**
 * Mark media as downloaded by client
 */
export const markMediaAsDownloaded = async (submissionIds: string[]): Promise<void> => {
  try {
    const { error } = await supabase
      .from('media_submissions')
      .update({ downloaded_by_client: true })
      .in('id', submissionIds);

    if (error) {
      console.error('[Activity] Failed to mark as downloaded:', error);
    }
  } catch (error) {
    console.error('[Activity] Error marking as downloaded:', error);
  }
};
