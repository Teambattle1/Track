import { supabase } from '../lib/supabase';
import { TaskVote, TeamMember, ChatMessage, Coordinate, DeviceType } from '../types';
import { detectDeviceTypeWithUA } from '../utils/deviceUtils';
import { createRecoveryCode, verifyRecoveryCode, deleteRecoveryCode, RecoveryCodeData } from './db';

const roundCoord = (c: Coordinate, digits = 5): Coordinate => ({
    lat: Number(c.lat.toFixed(digits)),
    lng: Number(c.lng.toFixed(digits))
});

// Cheap distance approximation to avoid pulling in heavier geo helpers.
const approxDistanceMeters = (a: Coordinate, b: Coordinate) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const x = dLng * Math.cos((lat1 + lat2) / 2);
    const y = dLat;
    return Math.sqrt(x * x + y * y) * R;
};

type VoteCallback = (votes: TaskVote[]) => void;
type VoteListener = { pointId: string | null; callback: VoteCallback };
type MemberCallback = (members: TeamMember[]) => void;
type ChatCallback = (message: ChatMessage) => void;
type GlobalLocationCallback = (locations: { teamId: string, location: Coordinate, name: string, photoUrl?: string, timestamp: number }[]) => void;

class TeamSyncService {
  private channel: any = null;
  private globalChannel: any = null;
  private votesDbChannel: any = null;
  
  private deviceId: string = '';
  private userName: string = 'Anonymous';
  private deviceType: DeviceType = 'mobile'; // Detect device type for responsive team view
  private userLocation: Coordinate | null = null; // Track local location
  private isSolving: boolean = false; // Track solving status locally
  private isRetired: boolean = false; // Track if user has retired from the team
  private lastPresenceSent: { isSolving: boolean; isRetired: boolean } | null = null;

  private gameId: string | null = null;
  private teamKey: string | null = null;
  private teamName: string | null = null;

  private lastLocationSentAt = 0;
  private lastLocationSent: Coordinate | null = null;
  private locationDirty = false;

  private votes: Record<string, TaskVote[]> = {};
  private members: Map<string, TeamMember> = new Map();

  // Track other team locations (Global view)
  private otherTeams: Map<string, { location: Coordinate, name: string, photoUrl?: string, teamId: string, timestamp: number }> = new Map();

  private voteListeners: VoteListener[] = [];
  private memberListeners: MemberCallback[] = [];
  private chatListeners: ChatCallback[] = [];
  private globalLocationListeners: GlobalLocationCallback[] = [];

  private presenceIntervalId: number | null = null;

  // Debouncing for performance optimization
  private memberNotifyTimeout: number | null = null;
  private lastMemberListHash: string = '';

  // Track latest vote timestamp PER DEVICE to safely ignore out-of-order packets without global clock sync issues
  private deviceVoteTimestamps: Record<string, number> = {}; 

  constructor() {
    let storedId = localStorage.getItem('geohunt_device_id');
    if (!storedId) {
        storedId = Math.random().toString(36).substr(2, 9);
        localStorage.setItem('geohunt_device_id', storedId);
    }
    this.deviceId = storedId;

    // Detect device type on initialization
    this.deviceType = detectDeviceTypeWithUA();
  }

  public getDeviceId() {
      return this.deviceId;
  }

  public getUserName() {
      return this.userName;
  }

  public getState() {
      return {
          gameId: this.gameId,
          teamId: this.teamKey,
          teamName: this.teamName || '',
          userName: this.userName,
          deviceId: this.deviceId
      };
  }

  public connect(gameId: string, teamName: string, userName: string) {
    if (this.channel) this.disconnect();

    this.userName = userName;
    this.gameId = gameId;
    this.teamName = teamName;
    this.teamKey = teamName.replace(/[^a-zA-Z0-9]/g, '_');

    // 1. Team-Specific Channel (For Voting & Presence)
    const channelId = `game_${gameId}_team_${this.teamKey}`;
    
    console.log(`[TeamSync] Connecting to ${channelId} as ${userName}`);

    this.channel = supabase.channel(channelId);

    this.channel
      .on('broadcast', { event: 'vote' }, (payload: any) => {
        this.handleIncomingVote(payload.payload as TaskVote);
      })
      .on('broadcast', { event: 'presence' }, (payload: any) => {
        const member = payload.payload as TeamMember;
        const existing = this.members.get(member.deviceId);

        // Presence heartbeats may omit location to reduce bandwidth.
        const merged: TeamMember = {
            ...(existing || {}),
            ...member,
            location: member.location ?? existing?.location,
            isSolving: member.isSolving ?? existing?.isSolving,
            isRetired: member.isRetired ?? existing?.isRetired
        } as TeamMember;

        this.members.set(member.deviceId, merged);
        this.notifyMemberListeners();
      })
      .on('broadcast', { event: 'retire_player' }, (payload: any) => {
        const { deviceId, isRetired } = payload.payload;

        // If this is me being retired/unretired by captain
        if (deviceId === this.deviceId) {
            this.isRetired = isRetired;
            this.sendPresence();
        }
      })
      .on('broadcast', { event: 'captain_change' }, (payload: any) => {
        console.log('[TeamSync] Captain changed:', payload.payload);
      })
      .on('broadcast', { event: 'member_removed' }, (payload: any) => {
        const { deviceId } = payload.payload;
        // Remove from local members map
        this.members.delete(deviceId);
        this.notifyMemberListeners();
        // If I was removed, could trigger disconnect — handled by lobby UI
      })
      .on('broadcast', { event: 'member_added' }, (payload: any) => {
        console.log('[TeamSync] New member added:', payload.payload);
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
           this.sendPresence(true); // Force initial send
           // Send presence periodically (lower frequency to reduce battery + bandwidth)
           if (this.presenceIntervalId) window.clearInterval(this.presenceIntervalId);
           this.presenceIntervalId = window.setInterval(() => this.sendPresence(false), 12000); // Reduced to 12s
        }
      });

    // 2. Global Game Channel (For Messages from Instructor & Captain Locations)
    this.connectGlobal(gameId);

    // 3. DB-backed votes (authoritative, survives refresh/reconnect)
    this.connectVotesDb();
  }

  public connectGlobal(gameId: string) {
      if (this.globalChannel) supabase.removeChannel(this.globalChannel);

      const globalId = `game_${gameId}_global`;
      console.log(`[TeamSync] Connecting to Global: ${globalId}`);

      this.globalChannel = supabase.channel(globalId);

      this.globalChannel
        .on('broadcast', { event: 'chat' }, (payload: any) => {
            this.handleIncomingChat(payload.payload as ChatMessage);
        })
        .on('broadcast', { event: 'global_location' }, (payload: any) => {
            this.handleGlobalLocation(payload.payload);
        })
        .subscribe();
  }

  private connectVotesDb() {
      if (!this.gameId || !this.teamKey) return;

      if (this.votesDbChannel) {
          supabase.removeChannel(this.votesDbChannel);
          this.votesDbChannel = null;
      }

      const channelId = `game_${this.gameId}_team_${this.teamKey}_votes_db`;
      this.votesDbChannel = supabase.channel(channelId);

      this.votesDbChannel
          .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'task_votes', filter: `game_id=eq.${this.gameId}` },
              (payload: any) => {
                  const row = payload?.new;
                  if (!row) return;
                  if (row.team_key !== this.teamKey) return;

                  const vote: TaskVote = {
                      deviceId: row.device_id,
                      userName: row.user_name,
                      pointId: row.point_id,
                      answer: row.answer,
                      timestamp: row.client_timestamp
                  };

                  this.handleIncomingVote(vote);
              }
          )
          .subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                  void this.loadVotesFromDb();
              }
          });
  }

  private async loadVotesFromDb() {
      if (!this.gameId || !this.teamKey) return;

      const { data, error } = await supabase
          .from('task_votes')
          .select('point_id, device_id, user_name, answer, client_timestamp')
          .eq('game_id', this.gameId)
          .eq('team_key', this.teamKey);

      if (error) {
          if (error?.code === '42P01') {
              console.warn('[TeamSync] task_votes table missing. Run Database Setup.');
          } else {
              console.warn('[TeamSync] loadVotesFromDb failed', error?.message || error);
          }
          return;
      }

      (data || []).forEach((row: any) => {
          const vote: TaskVote = {
              deviceId: row.device_id,
              userName: row.user_name,
              pointId: row.point_id,
              answer: row.answer,
              timestamp: row.client_timestamp
          };
          this.handleIncomingVote(vote);
      });
  }

  private async persistVoteToDb(vote: TaskVote) {
      if (!this.gameId || !this.teamKey) return;

      const { error } = await supabase.rpc('upsert_task_vote', {
          p_game_id: this.gameId,
          p_team_key: this.teamKey,
          p_point_id: vote.pointId,
          p_device_id: vote.deviceId,
          p_user_name: vote.userName,
          p_answer: vote.answer,
          p_client_timestamp: vote.timestamp
      });

      if (error) {
          if (error?.code === '42P01') {
              console.warn('[TeamSync] upsert_task_vote missing. Run Database Setup.');
          } else {
              console.warn('[TeamSync] persistVoteToDb failed', error?.message || error);
          }
      }
  }

  public disconnect() {
    if (this.presenceIntervalId) {
        window.clearInterval(this.presenceIntervalId);
        this.presenceIntervalId = null;
    }

    if (this.memberNotifyTimeout) {
        window.clearTimeout(this.memberNotifyTimeout);
        this.memberNotifyTimeout = null;
    }

    this.gameId = null;
    this.teamKey = null;
    this.teamName = null;
    this.lastLocationSentAt = 0;
    this.lastLocationSent = null;
    this.locationDirty = false;
    this.lastMemberListHash = '';
    this.lastPresenceSent = null;

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.globalChannel) {
        supabase.removeChannel(this.globalChannel);
        this.globalChannel = null;
    }
    if (this.votesDbChannel) {
        supabase.removeChannel(this.votesDbChannel);
        this.votesDbChannel = null;
    }
    this.votes = {};
    this.members.clear();
    this.otherTeams.clear();
  }

  public castVote(pointId: string, answer: any) {
    if (!this.channel) return;

    const vote: TaskVote = {
      deviceId: this.deviceId,
      userName: this.userName,
      pointId,
      answer,
      timestamp: Date.now()
    };

    // Update local state immediately for low-latency UI.
    this.handleIncomingVote(vote);

    // Broadcast for ultra-fast peer updates.
    this.channel.send({
      type: 'broadcast',
      event: 'vote',
      payload: vote
    });

    // Persist to DB for durability + authoritative ordering.
    void this.persistVoteToDb(vote);
  }

  public sendChatMessage(gameId: string, message: string, targetTeamId: string | null = null, isUrgent: boolean = false) {
      if (!this.globalChannel) {
          this.connectGlobal(gameId);
      }

      setTimeout(() => {
          const chatPayload: ChatMessage = {
              id: `msg-${Date.now()}`,
              gameId,
              targetTeamId,
              message,
              sender: 'Instructor',
              timestamp: Date.now(),
              isUrgent // Pass urgent flag
          };

          this.globalChannel.send({
              type: 'broadcast',
              event: 'chat',
              payload: chatPayload
          });
      }, 500);
  }

  // Send chat message as a team member (not instructor)
  public sendTeamChatMessage(gameId: string, message: string, senderName: string, teamName: string) {
      if (!this.globalChannel) {
          this.connectGlobal(gameId);
      }

      setTimeout(() => {
          const chatPayload: ChatMessage = {
              id: `msg-${Date.now()}-${this.deviceId}`,
              gameId,
              targetTeamId: null,
              message,
              sender: `${teamName}: ${senderName}`,
              timestamp: Date.now(),
              isUrgent: false
          };

          this.globalChannel.send({
              type: 'broadcast',
              event: 'chat',
              payload: chatPayload
          });
      }, 100);
  }

  // --- GLOBAL LOCATION LOGIC (Captain Visibility) ---
  public broadcastGlobalLocation(gameId: string, teamId: string, name: string, location: Coordinate, photoUrl?: string) {
      if (!this.globalChannel) return;

      this.globalChannel.send({
          type: 'broadcast',
          event: 'global_location',
          payload: { teamId, name, location: roundCoord(location), photoUrl, timestamp: Date.now() }
      });
  }

  private handleGlobalLocation(data: any) {
      // Store or update other team location
      this.otherTeams.set(data.teamId, { ...data, timestamp: data.timestamp || Date.now() });
      this.notifyGlobalLocationListeners();
  }

  private notifyGlobalLocationListeners() {
      // Filter out stale locations > 2 mins
      const now = Date.now();
      const active: any[] = [];
      const deadKeys: string[] = [];

      this.otherTeams.forEach((t, key) => {
          if (now - t.timestamp < 120000) {
              active.push(t);
          } else {
              deadKeys.push(key);
          }
      });
      
      deadKeys.forEach(k => this.otherTeams.delete(k));
      
      this.globalLocationListeners.forEach(cb => cb(active));
  }

  public subscribeToGlobalLocations(callback: GlobalLocationCallback) {
      this.globalLocationListeners.push(callback);
      return () => {
          this.globalLocationListeners = this.globalLocationListeners.filter(cb => cb !== callback);
      };
  }
  // --------------------------------------------------

  // Called by App.tsx whenever location updates
  public updateLocation(location: Coordinate) {
      this.userLocation = location;

      // Mark as dirty only when the user actually moves meaningfully.
      if (!this.lastLocationSent) {
          this.locationDirty = true;
          return;
      }

      const moved = approxDistanceMeters(this.lastLocationSent, location);
      if (moved >= 2) {
          this.locationDirty = true;
      }
  }

  // Called by TaskModal when opening/closing a task
  public updateStatus(isSolving: boolean) {
      this.isSolving = isSolving;
      this.sendPresence();
  }

  private sendPresence(force: boolean = false) {
      if (!this.channel) return;

      const now = Date.now();
      const shouldSendLocation =
          !!this.userLocation &&
          (this.locationDirty || now - this.lastLocationSentAt > 20000);

      const me: TeamMember = {
          deviceId: this.deviceId,
          userName: this.userName,
          lastSeen: now,
          location: shouldSendLocation && this.userLocation ? roundCoord(this.userLocation) : undefined,
          isSolving: this.isSolving,
          isRetired: this.isRetired,
          deviceType: this.deviceType
      };

      this.channel.send({
          type: 'broadcast',
          event: 'presence',
          payload: me
      });

      // Track what we sent
      this.lastPresenceSent = {
          isSolving: this.isSolving,
          isRetired: this.isRetired
      };

      if (shouldSendLocation && this.userLocation) {
          this.lastLocationSent = this.userLocation;
          this.lastLocationSentAt = now;
          this.locationDirty = false;
      }

      const existing = this.members.get(this.deviceId);
      this.members.set(this.deviceId, {
          ...(existing || {}),
          ...me,
          location: me.location ?? existing?.location
      } as TeamMember);

      this.notifyMemberListeners();
  }

  private handleIncomingVote(vote: TaskVote) {
    // Unique key per device per task to track sequence
    const trackingKey = `${vote.pointId}_${vote.deviceId}`;
    const lastTimestamp = this.deviceVoteTimestamps[trackingKey] || 0;

    // Check: Ignore votes that are older than the last processed vote FROM THIS DEVICE.
    // This prevents network lag from overwriting a newer vote with an old one from the same user.
    // We do NOT compare against other users to avoid clock skew issues.
    if (vote.timestamp < lastTimestamp) {
        console.warn("Ignoring outdated vote packet", vote);
        return;
    }
    
    this.deviceVoteTimestamps[trackingKey] = vote.timestamp;

    if (!this.votes[vote.pointId]) {
        this.votes[vote.pointId] = [];
    }
    
    // Replace previous vote from this specific device
    this.votes[vote.pointId] = this.votes[vote.pointId].filter(v => v.deviceId !== vote.deviceId);
    this.votes[vote.pointId].push(vote);

    // Update member activity on vote
    this.members.set(vote.deviceId, { 
        deviceId: vote.deviceId, 
        userName: vote.userName, 
        lastSeen: Date.now(),
        // Preserve location and solving status if we have it already
        location: this.members.get(vote.deviceId)?.location,
        isSolving: this.members.get(vote.deviceId)?.isSolving
    });
    this.notifyMemberListeners();

    this.voteListeners.forEach(l => {
        if (l.pointId === null || l.pointId === vote.pointId) {
            l.callback(this.votes[vote.pointId]);
        }
    });
  }

  private handleIncomingChat(msg: ChatMessage) {
      this.chatListeners.forEach(cb => cb(msg));
  }

  private notifyMemberListeners() {
      // Debounce notifications to reduce re-renders
      if (this.memberNotifyTimeout) {
          window.clearTimeout(this.memberNotifyTimeout);
      }

      this.memberNotifyTimeout = window.setTimeout(() => {
          const now = Date.now();
          const active: TeamMember[] = [];
          const deadKeys: string[] = [];

          this.members.forEach((m, key) => {
              // Strict Zombie Filtering: 60 seconds (1 minute)
              if (now - m.lastSeen < 60000) {
                  active.push(m);
              } else {
                  deadKeys.push(key);
              }
          });

          // Cleanup dead members from map to keep memory clean
          deadKeys.forEach(k => this.members.delete(k));

          // Only notify if members actually changed (check hash)
          const currentHash = active.map(m => `${m.deviceId}:${m.lastSeen}:${m.isSolving}:${m.isRetired}`).sort().join('|');
          if (currentHash !== this.lastMemberListHash) {
              this.lastMemberListHash = currentHash;
              this.memberListeners.forEach(cb => cb(active));
          }
      }, 100); // Debounce for 100ms
  }

  public subscribeToVotesForTask(pointId: string, callback: VoteCallback) {
      this.voteListeners.push({ pointId, callback });
      callback(this.votes[pointId] || []);
      return () => {
          this.voteListeners = this.voteListeners.filter(l => l.callback !== callback);
      };
  }

  // Backwards-compatible: subscribes to all vote events.
  public subscribeToVotes(callback: VoteCallback) {
      this.voteListeners.push({ pointId: null, callback });
      return () => {
          this.voteListeners = this.voteListeners.filter(l => l.callback !== callback);
      };
  }
  
  public subscribeToMembers(callback: MemberCallback) {
      this.memberListeners.push(callback);
      callback(Array.from(this.members.values()));
      return () => {
          this.memberListeners = this.memberListeners.filter(cb => cb !== callback);
      }
  }

  public subscribeToChat(callback: ChatCallback) {
      this.chatListeners.push(callback);
      return () => {
          this.chatListeners = this.chatListeners.filter(cb => cb !== callback);
      };
  }

  public subscribeToMemberCount(callback: (c: number) => void) {
      return this.subscribeToMembers((members) => callback(members.length));
  }

  public getVotesForTask(pointId: string): TaskVote[] {
      return this.votes[pointId] || [];
  }

  // Retire myself from the team (votes won't count)
  public retireMyself() {
      this.isRetired = true;
      this.sendPresence();
  }

  // Un-retire myself (rejoin voting)
  public unretireMyself() {
      this.isRetired = false;
      this.sendPresence();
  }

  // Captain can retire another player by deviceId
  public retirePlayer(deviceId: string) {
      if (!this.channel) return;

      // Broadcast retirement command
      this.channel.send({
          type: 'broadcast',
          event: 'retire_player',
          payload: { deviceId, isRetired: true }
      });
  }

  // Captain can un-retire another player
  public unretirePlayer(deviceId: string) {
      if (!this.channel) return;

      // Broadcast un-retirement command
      this.channel.send({
          type: 'broadcast',
          event: 'retire_player',
          payload: { deviceId, isRetired: false }
      });
  }

  // Get current retirement status
  public isPlayerRetired(): boolean {
      return this.isRetired;
  }

  // Get all members including their retirement status
  public getAllMembers(): TeamMember[] {
      return Array.from(this.members.values());
  }

  // --- TEAM MANAGEMENT BROADCASTS ---
  // Captain changed — notify all team members
  public broadcastCaptainChange(newCaptainDeviceId: string, newCaptainName: string) {
      if (!this.channel) return;
      this.channel.send({
          type: 'broadcast',
          event: 'captain_change',
          payload: { deviceId: newCaptainDeviceId, userName: newCaptainName }
      });
  }

  // Member removed from team — notify all team members
  public broadcastMemberRemoved(removedDeviceId: string, removedName: string) {
      if (!this.channel) return;
      this.channel.send({
          type: 'broadcast',
          event: 'member_removed',
          payload: { deviceId: removedDeviceId, userName: removedName }
      });
  }

  // New member added to team — notify all team members
  public broadcastMemberAdded(addedDeviceId: string, addedName: string) {
      if (!this.channel) return;
      this.channel.send({
          type: 'broadcast',
          event: 'member_added',
          payload: { deviceId: addedDeviceId, userName: addedName }
      });
  }

  // --- RECOVERY CODE METHODS ---
  // Generate a recovery code for this player to reconnect on a new device

  public async generateRecoveryCode(): Promise<string | null> {
      if (!this.gameId || !this.teamKey) {
          console.error('[TeamSync] Cannot generate recovery code: not connected to a game');
          return null;
      }

      const userPhoto = localStorage.getItem('geohunt_temp_user_photo') || undefined;
      const teamName = this.teamName || this.teamKey.replace(/_/g, ' ');

      const code = await createRecoveryCode(
          this.gameId,
          teamName,
          this.deviceId,
          this.userName,
          userPhoto
      );

      if (code) {
          // Store the code locally so we can show it again
          localStorage.setItem('geohunt_recovery_code', code);
          console.log(`[TeamSync] Recovery code generated: ${code}`);
      }

      return code;
  }

  // Get the current recovery code if one exists
  public getCurrentRecoveryCode(): string | null {
      return localStorage.getItem('geohunt_recovery_code');
  }

  // Reconnect using a recovery code - this takes over the old device's identity
  public async reconnectWithCode(code: string): Promise<RecoveryCodeData | null> {
      const recoveryData = await verifyRecoveryCode(code);

      if (!recoveryData) {
          console.warn('[TeamSync] Invalid or expired recovery code');
          return null;
      }

      // Transfer identity: set this device to use the old deviceId
      localStorage.setItem('geohunt_device_id', recoveryData.deviceId);
      this.deviceId = recoveryData.deviceId;

      // Restore user photo if available
      if (recoveryData.userPhoto) {
          localStorage.setItem('geohunt_temp_user_photo', recoveryData.userPhoto);
      }

      // Clean up the used recovery code
      await deleteRecoveryCode(code);
      localStorage.removeItem('geohunt_recovery_code');

      console.log(`[TeamSync] Reconnected as ${recoveryData.userName} (device: ${recoveryData.deviceId})`);

      return recoveryData;
  }

  // Get current connection info for display
  public getConnectionInfo(): { gameId: string | null; teamName: string | null; userName: string; deviceId: string } {
      return {
          gameId: this.gameId,
          teamName: this.teamName || (this.teamKey ? this.teamKey.replace(/_/g, ' ') : null),
          userName: this.userName,
          deviceId: this.deviceId
      };
  }
}

export const teamSync = new TeamSyncService();
export type { RecoveryCodeData };
