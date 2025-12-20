import { supabase } from '../lib/supabase';
import { TaskVote, TeamMember } from '../types';

type VoteCallback = (votes: TaskVote[]) => void;
type MemberCallback = (members: TeamMember[]) => void;

class TeamSyncService {
  private channel: any = null;
  private deviceId: string = '';
  private userName: string = 'Anonymous'; // Default
  private votes: Record<string, TaskVote[]> = {}; // pointId -> votes
  private members: Map<string, TeamMember> = new Map();
  
  private voteListeners: VoteCallback[] = [];
  private memberListeners: MemberCallback[] = [];

  constructor() {
    // Generate a semi-persistent device ID if not exists
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

    // Clean team name to be channel-safe
    const channelId = `game_${gameId}_team_${teamName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    console.log(`[TeamSync] Connecting to ${channelId} as ${userName}`);

    this.channel = supabase.channel(channelId);

    this.channel
      .on('broadcast', { event: 'vote' }, (payload: any) => {
        this.handleIncomingVote(payload.payload as TaskVote);
      })
      .on('broadcast', { event: 'presence' }, (payload: any) => {
        const member = payload.payload as TeamMember;
        this.members.set(member.deviceId, member);
        this.notifyMemberListeners();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
           this.sendPresence();
           // Send presence periodically
           setInterval(() => this.sendPresence(), 5000); 
        }
      });
  }

  public disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.votes = {};
    this.members.clear();
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

    // Store locally immediately
    this.handleIncomingVote(vote);

    // Broadcast to team
    this.channel.send({
      type: 'broadcast',
      event: 'vote',
      payload: vote
    });
  }

  private sendPresence() {
      if(!this.channel) return;
      const me: TeamMember = {
          deviceId: this.deviceId,
          userName: this.userName,
          lastSeen: Date.now()
      };
      this.channel.send({
          type: 'broadcast',
          event: 'presence',
          payload: me
      });
      // Add self to map just in case
      this.members.set(this.deviceId, me);
      this.notifyMemberListeners();
  }

  private handleIncomingVote(vote: TaskVote) {
    // Initialize array if needed
    if (!this.votes[vote.pointId]) {
        this.votes[vote.pointId] = [];
    }

    // Remove existing vote from this device if exists (update logic)
    this.votes[vote.pointId] = this.votes[vote.pointId].filter(v => v.deviceId !== vote.deviceId);
    
    // Add new vote
    this.votes[vote.pointId].push(vote);

    // Ensure member is counted (if voting implies presence)
    this.members.set(vote.deviceId, { 
        deviceId: vote.deviceId, 
        userName: vote.userName, 
        lastSeen: Date.now() 
    });
    this.notifyMemberListeners();

    // Notify listeners
    this.voteListeners.forEach(cb => cb(this.votes[vote.pointId]));
  }

  private notifyMemberListeners() {
      // Filter out stale members (offline > 20s)
      const now = Date.now();
      const active: TeamMember[] = [];
      this.members.forEach((m) => {
          if (now - m.lastSeen < 20000) active.push(m);
      });
      
      this.memberListeners.forEach(cb => cb(active));
  }

  public subscribeToVotes(callback: VoteCallback) {
    this.voteListeners.push(callback);
    return () => {
      this.voteListeners = this.voteListeners.filter(cb => cb !== callback);
    };
  }
  
  public subscribeToMembers(callback: MemberCallback) {
      this.memberListeners.push(callback);
      // Immediate callback with current state
      callback(Array.from(this.members.values()));
      return () => {
          this.memberListeners = this.memberListeners.filter(cb => cb !== callback);
      }
  }

  // Deprecated wrapper
  public subscribeToMemberCount(callback: (c: number) => void) {
      return this.subscribeToMembers((members) => callback(members.length));
  }

  public getVotesForTask(pointId: string): TaskVote[] {
      return this.votes[pointId] || [];
  }
}

export const teamSync = new TeamSyncService();