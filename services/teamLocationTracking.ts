/**
 * Team Location Tracking Service
 * Handles GPS breadcrumbs, task attempts, and impossible travel detection
 */

import { supabase } from '../lib/supabase';
import { TeamHistory, TaskAttempt } from '../types/teamHistory';
import { Coordinate } from '../types';

export interface TeamLocationRecord {
  id: string;
  team_id: string;
  game_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  is_impossible_travel?: boolean;
}

export interface TaskAttemptRecord {
  id: string;
  team_id: string;
  game_id: string;
  task_id: string;
  task_title?: string;
  latitude: number;
  longitude: number;
  status: 'CORRECT' | 'WRONG' | 'SUBMITTED';
  timestamp: string;
  answer?: any;
}

/**
 * Records a team's GPS location
 */
export const recordTeamLocation = async (
  teamId: string,
  gameId: string,
  location: Coordinate,
  accuracy?: number
): Promise<{ success: boolean; isImpossibleTravel?: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('team_locations')
      .insert({
        team_id: teamId,
        game_id: gameId,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: accuracy,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      const errorMessage = error.message || JSON.stringify(error);
      console.error('[TeamTracking] Error recording location:', errorMessage);
      return { success: false, error: errorMessage };
    }

    return {
      success: true,
      isImpossibleTravel: data?.is_impossible_travel || false,
    };
  } catch (error: any) {
    const errorMessage = error?.message || JSON.stringify(error);
    console.error('[TeamTracking] Exception recording location:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Records a task attempt
 */
export const recordTaskAttempt = async (
  teamId: string,
  gameId: string,
  taskId: string,
  taskTitle: string | undefined,
  location: Coordinate,
  status: 'CORRECT' | 'WRONG' | 'SUBMITTED',
  answer?: any
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('task_attempts').insert({
      team_id: teamId,
      game_id: gameId,
      task_id: taskId,
      task_title: taskTitle,
      latitude: location.lat,
      longitude: location.lng,
      status: status,
      answer: answer,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      const errorMessage = error.message || JSON.stringify(error);
      console.error('[TeamTracking] Error recording task attempt:', errorMessage);
      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (error: any) {
    const errorMessage = error?.message || JSON.stringify(error);
    console.error('[TeamTracking] Exception recording task attempt:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Fetches team movement history for a game
 */
export const fetchTeamHistory = async (gameId: string): Promise<TeamHistory[]> => {
  try {
    // Fetch all teams for this game
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .eq('game_id', gameId);

    if (teamsError) {
      const errorMessage = teamsError.message || JSON.stringify(teamsError);
      console.error('[TeamTracking] Error fetching teams:', errorMessage);
      return [];
    }

    if (!teams || teams.length === 0) return [];

    // Fetch location history and task attempts for all teams
    const teamHistories: TeamHistory[] = [];

    for (const team of teams) {
      // Fetch location breadcrumbs
      const { data: locations, error: locError } = await supabase
        .from('team_locations')
        .select('*')
        .eq('team_id', team.id)
        .eq('game_id', gameId)
        .order('timestamp', { ascending: true });

      // Fetch task attempts
      const { data: attempts, error: attemptsError } = await supabase
        .from('task_attempts')
        .select('*')
        .eq('team_id', team.id)
        .eq('game_id', gameId)
        .order('timestamp', { ascending: true });

      if (locError || attemptsError) {
        console.error('[TeamTracking] Error fetching history:', locError || attemptsError);
        continue;
      }

      // Transform to TeamHistory format
      const path = (locations || []).map((loc: any) => ({
        lat: parseFloat(loc.latitude),
        lng: parseFloat(loc.longitude),
        timestamp: new Date(loc.timestamp).getTime(),
      }));

      const tasks: TaskAttempt[] = (attempts || []).map((att: any) => ({
        id: att.id,
        coordinate: {
          lat: parseFloat(att.latitude),
          lng: parseFloat(att.longitude),
        },
        status: att.status,
        timestamp: new Date(att.timestamp).getTime(),
        taskTitle: att.task_title,
      }));

      // Generate team color from hash
      const teamColor = generateTeamColor(team.name);

      teamHistories.push({
        teamId: team.id,
        teamName: team.name,
        color: teamColor,
        path,
        tasks,
      });
    }

    return teamHistories;
  } catch (error) {
    console.error('[TeamTracking] Exception fetching team history:', error);
    return [];
  }
};

/**
 * Fetches impossible travel warnings for a game
 */
export const fetchImpossibleTravelWarnings = async (
  gameId: string
): Promise<
  Array<{
    teamId: string;
    teamName: string;
    location: Coordinate;
    timestamp: Date;
    speed: number;
  }>
> => {
  try {
    const { data, error } = await supabase
      .from('team_locations')
      .select(
        `
        id,
        team_id,
        latitude,
        longitude,
        timestamp,
        speed,
        teams!inner(name)
      `
      )
      .eq('game_id', gameId)
      .eq('is_impossible_travel', true)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[TeamTracking] Error fetching impossible travel warnings:', error.message || JSON.stringify(error));
      return [];
    }

    return (data || []).map((record: any) => ({
      teamId: record.team_id,
      teamName: record.teams?.name || 'Unknown Team',
      location: {
        lat: parseFloat(record.latitude),
        lng: parseFloat(record.longitude),
      },
      timestamp: new Date(record.timestamp),
      speed: parseFloat(record.speed || 0),
    }));
  } catch (error: any) {
    console.error('[TeamTracking] Exception fetching impossible travel warnings:', error?.message || JSON.stringify(error));
    return [];
  }
};

/**
 * Generates a consistent color for a team name
 */
const generateTeamColor = (teamName: string): string => {
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

/**
 * Subscribe to real-time team location updates
 */
export const subscribeToTeamLocations = (
  gameId: string,
  onUpdate: (location: TeamLocationRecord) => void
) => {
  const channel = supabase
    .channel(`team_locations_${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'team_locations',
        filter: `game_id=eq.${gameId}`,
      },
      (payload: any) => {
        if (payload.new) {
          onUpdate(payload.new as TeamLocationRecord);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
