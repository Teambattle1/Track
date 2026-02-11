/**
 * AroundTheWorldSync - Real-time sync service for Around The World game
 * Handles team name availability and game state sync via Supabase
 */

import { supabase } from '../lib/supabase';
import { Team, Game } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

type TeamUpdateCallback = (teams: Team[]) => void;
type GameUpdateCallback = (game: Game) => void;

class AroundTheWorldSync {
  private teamsChannel: RealtimeChannel | null = null;
  private gameChannel: RealtimeChannel | null = null;
  private currentGameId: string | null = null;
  private teamListeners: TeamUpdateCallback[] = [];
  private gameListeners: GameUpdateCallback[] = [];

  /**
   * Connect to a game's real-time channels
   */
  async connect(gameId: string): Promise<void> {
    // Disconnect from previous game if any
    if (this.currentGameId && this.currentGameId !== gameId) {
      await this.disconnect();
    }

    this.currentGameId = gameId;

    // Subscribe to team changes for this game
    this.teamsChannel = supabase.channel(`atw-teams-${gameId}`);
    this.teamsChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `game_id=eq.${gameId}`
        },
        async (payload: any) => {
          console.log('[ATW Sync] Team change detected:', payload.eventType);
          // Fetch updated teams list
          const teams = await this.fetchTeams(gameId);
          this.notifyTeamListeners(teams);
        }
      )
      .subscribe((status: string) => {
        console.log('[ATW Sync] Teams channel status:', status);
        if (status === 'SUBSCRIBED') {
          // Initial load
          this.fetchTeams(gameId).then(teams => {
            this.notifyTeamListeners(teams);
          });
        }
      });

    // Subscribe to game changes
    this.gameChannel = supabase.channel(`atw-game-${gameId}`);
    this.gameChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        async (payload: any) => {
          console.log('[ATW Sync] Game change detected:', payload.eventType);
          if (payload.new && payload.new.data) {
            const game = payload.new.data as Game;
            this.notifyGameListeners(game);
          }
        }
      )
      .subscribe((status: string) => {
        console.log('[ATW Sync] Game channel status:', status);
      });
  }

  /**
   * Disconnect from all channels
   */
  async disconnect(): Promise<void> {
    if (this.teamsChannel) {
      await supabase.removeChannel(this.teamsChannel);
      this.teamsChannel = null;
    }
    if (this.gameChannel) {
      await supabase.removeChannel(this.gameChannel);
      this.gameChannel = null;
    }
    this.currentGameId = null;
  }

  /**
   * Fetch teams for a game from Supabase
   */
  private async fetchTeams(gameId: string): Promise<Team[]> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('game_id', gameId);

      if (error) {
        console.error('[ATW Sync] Error fetching teams:', error);
        return [];
      }

      // Transform from Supabase format to Team type
      return (data || []).map(row => ({
        id: row.id,
        gameId: row.game_id,
        name: row.name,
        joinCode: row.join_code,
        photoUrl: row.photo_url,
        members: (row.members || []).map((m: any) => typeof m === 'string' ? JSON.parse(m) : m),
        score: row.score || 0,
        completedPointIds: row.completed_point_ids || [],
        updatedAt: row.updated_at,
        captainDeviceId: row.captain_device_id,
        isStarted: row.is_started,
        startedAt: row.started_at,
        createdAt: row.created_at,
        color: row.color,
        vehicle: row.vehicle
      }));
    } catch (err) {
      console.error('[ATW Sync] Error in fetchTeams:', err);
      return [];
    }
  }

  /**
   * Register a new team with a Victorian name
   */
  async registerTeam(
    gameId: string,
    teamName: string,
    vehicleId: string,
    deviceId: string,
    userName: string
  ): Promise<Team | null> {
    try {
      const teamId = `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const joinCode = Math.random().toString(36).substr(2, 6).toUpperCase();

      const { data, error } = await supabase
        .from('teams')
        .insert({
          id: teamId,
          game_id: gameId,
          name: teamName,
          join_code: joinCode,
          members: [{ name: userName, deviceId, role: 'captain' }],
          score: 0,
          captain_device_id: deviceId,
          is_started: false,
          vehicle: vehicleId,
          created_at: Date.now(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[ATW Sync] Error registering team:', error);
        throw new Error(error.message);
      }

      return {
        id: data.id,
        gameId: data.game_id,
        name: data.name,
        joinCode: data.join_code,
        members: (data.members || []).map((m: any) => typeof m === 'string' ? JSON.parse(m) : m),
        score: data.score,
        completedPointIds: [],
        updatedAt: data.updated_at,
        captainDeviceId: data.captain_device_id,
        isStarted: data.is_started,
        vehicle: data.vehicle
      };
    } catch (err: any) {
      console.error('[ATW Sync] Error in registerTeam:', err);
      throw err;
    }
  }

  /**
   * Check if a team name is already taken
   */
  async isTeamNameTaken(gameId: string, teamName: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('game_id', gameId)
        .eq('name', teamName)
        .limit(1);

      if (error) {
        console.error('[ATW Sync] Error checking team name:', error);
        return true; // Assume taken on error to be safe
      }

      return (data?.length || 0) > 0;
    } catch (err) {
      console.error('[ATW Sync] Error in isTeamNameTaken:', err);
      return true;
    }
  }

  /**
   * Get list of taken team names for a game
   */
  async getTakenTeamNames(gameId: string): Promise<string[]> {
    const teams = await this.fetchTeams(gameId);
    return teams.map(t => t.name);
  }

  /**
   * Add listener for team updates
   */
  onTeamsUpdate(callback: TeamUpdateCallback): () => void {
    this.teamListeners.push(callback);
    return () => {
      this.teamListeners = this.teamListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Add listener for game updates
   */
  onGameUpdate(callback: GameUpdateCallback): () => void {
    this.gameListeners.push(callback);
    return () => {
      this.gameListeners = this.gameListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all team listeners
   */
  private notifyTeamListeners(teams: Team[]): void {
    this.teamListeners.forEach(cb => {
      try {
        cb(teams);
      } catch (err) {
        console.error('[ATW Sync] Error in team listener:', err);
      }
    });
  }

  /**
   * Notify all game listeners
   */
  private notifyGameListeners(game: Game): void {
    this.gameListeners.forEach(cb => {
      try {
        cb(game);
      } catch (err) {
        console.error('[ATW Sync] Error in game listener:', err);
      }
    });
  }
}

// Singleton instance
export const atwSync = new AroundTheWorldSync();
