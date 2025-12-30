import { supabase } from '../lib/supabase';
import { TaskVote, TeamMember, ChatMessage, Coordinate } from '../types';

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
  private userLocation: Coordinate | null = null; // Track local location
  private isSolving: boolean = false; // Track solving status locally
  private isRetired: boolean = false; // Track if user has retired from the team

  private gameId: string | null = null;
  private teamKey: string | null = null;

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

  // Track latest vote timestamp PER DEVICE to safely ignore out-of-order packets without global clock sync issues
  private deviceVoteTimestamps: Record<string, number> = {}; 

  constructor() {
    let storedId = localStorage.getItem('geohunt_device_id');
    if (!storedId) {
        storedId = Math.random().toString(36).substr(2, 9);
        localStorage.setItem('geohunt_device_id', storedId);
    }
    this.deviceId = storedId;
  }

  public getDeviceId() {
      return this.deviceId;
  }

  public getUserName() {
      return this.userName;
  }

  public connect(gameId: string, teamName: string, userName: string) {
    if (this.channel) this.disconnect();

    this.userName = userName;
    this.gameId = gameId;
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
            isSolving: member.isSolving ?? existing?.isSolving
        } as TeamMember;

        this.members.set(member.deviceId, merged);
        this.notifyMemberListeners();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
           this.sendPresence();
           // Send presence periodically (lower frequency to reduce battery + bandwidth)
           if (this.presenceIntervalId) window.clearInterval(this.presenceIntervalId);
           this.presenceIntervalId = window.setInterval(() => this.sendPresence(), 8000);
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

    this.gameId = null;
    this.teamKey = null;
    this.lastLocationSentAt = 0;
    this.lastLocationSent = null;
    this.locationDirty = false;

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

  private sendPresence() {
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
          isSolving: this.isSolving
      };

      this.channel.send({
          type: 'broadcast',
          event: 'presence',
          payload: me
      });

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
      
      this.memberListeners.forEach(cb => cb(active));
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
}

export const teamSync = new TeamSyncService();
