
import { supabase } from '../lib/supabase';
import { TaskVote, TeamMember } from '../types';

type VoteCallback = (votes: TaskVote[]) => void;
type MemberCallback = (count: number) => void;

class TeamSyncService {
  private channel: any = null;
  private deviceId: string = '';
  private votes: Record<string, TaskVote[]> = {}; // pointId -> votes
  private members: Set<string> = new Set();
  
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

  public connect(gameId: string, teamName: string) {
    if (this.channel) this.disconnect();

    // Clean team name to be channel-safe
    const channelId = `game_${gameId}_team_${teamName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    console.log(`[TeamSync] Connecting to ${channelId}`);

    this.channel = supabase.channel(channelId);

    this.channel
      .on('broadcast', { event: 'vote' }, (payload: any) => {
        this.handleIncomingVote(payload.payload as TaskVote);
      })
      .on('broadcast', { event: 'presence' }, (payload: any) => {
        // Simple heartbeat handling
        this.members.add(payload.payload.deviceId);
        this.notifyMemberListeners();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
           this.sendPresence();
           // Send presence periodically
           setInterval(() => this.sendPresence(), 10000); 
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
      this.channel.send({
          type: 'broadcast',
          event: 'presence',
          payload: { deviceId: this.deviceId }
      });
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

    // Ensure member is counted
    this.members.add(vote.deviceId);
    this.notifyMemberListeners();

    // Notify listeners
    this.voteListeners.forEach(cb => cb(this.votes[vote.pointId]));
  }

  private notifyMemberListeners() {
      const count = this.members.size;
      this.memberListeners.forEach(cb => cb(count));
  }

  public subscribeToVotes(callback: VoteCallback) {
    this.voteListeners.push(callback);
    return () => {
      this.voteListeners = this.voteListeners.filter(cb => cb !== callback);
    };
  }
  
  public subscribeToMemberCount(callback: MemberCallback) {
      this.memberListeners.push(callback);
      return () => {
          this.memberListeners = this.memberListeners.filter(cb => cb !== callback);
      }
  }

  public getVotesForTask(pointId: string): TaskVote[] {
      return this.votes[pointId] || [];
  }
}

export const teamSync = new TeamSyncService();
