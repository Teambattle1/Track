import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Users, Shield, Crown, UserX, UserCheck,
  QrCode, Copy, Check, RefreshCw, Clock, Wifi, WifiOff,
  Smartphone, Tablet, Monitor, Trophy, ChevronDown, ChevronUp,
  Trash2, MessageSquare, BarChart3, Send, CheckCircle, Circle,
  AlertCircle, Pencil, XCircle, Target, RotateCcw, Vote
} from 'lucide-react';
import { Team, Game, GamePoint, TeamMember, TeamMemberData, TaskVote, ChatMessage } from '../types';
import { teamSync } from '../services/teamSync';
import * as db from '../services/db';
import { getCountdownState, formatCountdown, CountdownInfo, generateTaskVoteCode } from '../utils/teamUtils';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import MessagePopup from './MessagePopup';
import DOMPurify from 'dompurify';

// Notification sound using Web Audio API (no external files)
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Play two quick tones for a pleasant notification
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playTone(880, ctx.currentTime, 0.15);       // A5
    playTone(1100, ctx.currentTime + 0.12, 0.2); // ~C#6
    playTone(1320, ctx.currentTime + 0.25, 0.25); // E6
    // Cleanup
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {
    // Audio not available
  }
};

type LobbyTab = 'MEMBERS' | 'VOTES' | 'CHAT';

interface TeamLobbyViewProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  game?: Game;
  allTeams?: Team[];
  isCaptain?: boolean;
  onCompleteTask?: (pointId: string, score: number) => void;
}

const TeamLobbyView: React.FC<TeamLobbyViewProps> = ({
  isOpen,
  onClose,
  teamId,
  game,
  allTeams,
  isCaptain: isCaptainProp,
  onCompleteTask
}) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [liveMembers, setLiveMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [countdown, setCountdown] = useState<CountdownInfo | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [showQrSection, setShowQrSection] = useState(true);
  const [activeTab, setActiveTab] = useState<LobbyTab>('MEMBERS');
  const countdownRef = useRef<number | null>(null);
  const myDeviceId = teamSync.getDeviceId();

  // --- VOTE STATE ---
  const [taskVotes, setTaskVotes] = useState<Record<string, TaskVote[]>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [selectedVoteTask, setSelectedVoteTask] = useState<string | null>(null);
  const [captainAnswer, setCaptainAnswer] = useState<string>('');
  const [captainSelectedOptions, setCaptainSelectedOptions] = useState<string[]>([]);
  const [captainSliderValue, setCaptainSliderValue] = useState<number>(50);
  const [captainSelectedAnswer, setCaptainSelectedAnswer] = useState<string | null>(null);
  const [voteQrDataUrls, setVoteQrDataUrls] = useState<Record<string, string>>({});

  // --- CHAT STATE ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const [chatPopup, setChatPopup] = useState<ChatMessage | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const chatChannelReadyRef = useRef(false);
  const seenMsgIdsRef = useRef<Set<string>>(new Set());

  // Determine captain status — prop takes priority, fallback to captainDeviceId match
  // If isCaptainProp is explicitly passed (true or false), use it; otherwise check captainDeviceId
  const isCaptain = isCaptainProp !== undefined ? isCaptainProp : (team?.captainDeviceId === myDeviceId);

  // Calculate rank
  const teamRank = allTeams && team
    ? [...allTeams].sort((a, b) => b.score - a.score).findIndex(t => t.id === team.id) + 1
    : null;
  const totalTeams = allTeams?.length || 0;

  // Load team data from DB
  const loadTeam = useCallback(async () => {
    try {
      const data = await db.fetchTeam(teamId);
      if (data) setTeam(data);
    } catch (err) {
      console.error('[TeamLobbyView] Error loading team:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!isOpen) return;
    loadTeam();
  }, [isOpen, teamId, loadTeam]);

  // Check for pending vote task from deep link
  useEffect(() => {
    if (!isOpen) return;
    const pendingTaskId = localStorage.getItem('geohunt_pending_vote_task');
    if (pendingTaskId) {
      localStorage.removeItem('geohunt_pending_vote_task');
      localStorage.removeItem('geohunt_pending_vote_code');
      setActiveTab('VOTES');
      setSelectedVoteTask(pendingTaskId);
    }
  }, [isOpen]);

  // Subscribe to live members via teamSync
  useEffect(() => {
    if (!isOpen) return;
    const unsub = teamSync.subscribeToMembers(members => {
      setLiveMembers(members);
    });
    setLiveMembers(teamSync.getAllMembers());
    return unsub;
  }, [isOpen]);

  // Periodic tick to re-evaluate online/offline status (lastSeen check)
  const [, setOnlineTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(() => setOnlineTick(t => t + 1), 15000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  // Subscribe to votes for all game tasks
  useEffect(() => {
    if (!isOpen || !game?.points) return;
    const unsubs: (() => void)[] = [];
    game.points.forEach(point => {
      const unsub = teamSync.subscribeToVotesForTask(point.id, (votes) => {
        setTaskVotes(prev => ({ ...prev, [point.id]: votes }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [isOpen, game?.points]);

  // Subscribe to chat via own Supabase channel with self: true
  useEffect(() => {
    if (!isOpen || !game?.id) return;

    const channelId = `lobby_chat_${game.id}_${teamId}`;
    const channel = supabase.channel(channelId, {
      config: { broadcast: { self: true } }
    });

    channel
      .on('broadcast', { event: 'chat' }, (payload: any) => {
        const msg = payload.payload as ChatMessage;
        if (!msg) return;
        // Deduplicate
        if (seenMsgIdsRef.current.has(msg.id)) return;
        seenMsgIdsRef.current.add(msg.id);

        setChatMessages(prev => [...prev, msg]);

        // Check if this is from someone else (not me)
        const isFromMe = msg.id.includes(myDeviceId);
        if (!isFromMe) {
          // Play notification sound
          playNotificationSound();
          // Show popup if not on CHAT tab
          setChatPopup(msg);
          setUnreadChat(prev => prev + 1);
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          chatChannelReadyRef.current = true;
          console.log('[TeamLobbyView] Chat channel ready:', channelId);
        }
      });

    chatChannelRef.current = channel;

    // Also listen to the main global channel for gamemaster messages
    const globalId = `lobby_global_${game.id}_${teamId}`;
    const globalChannel = supabase.channel(globalId);
    globalChannel
      .on('broadcast', { event: 'chat' }, (payload: any) => {
        const msg = payload.payload as ChatMessage;
        if (!msg) return;
        if (seenMsgIdsRef.current.has(msg.id)) return;
        seenMsgIdsRef.current.add(msg.id);

        setChatMessages(prev => [...prev, msg]);
        const isFromMe = msg.id.includes(myDeviceId);
        if (!isFromMe) {
          playNotificationSound();
          setChatPopup(msg);
          setUnreadChat(prev => prev + 1);
        }
      })
      .subscribe();

    // Also subscribe to teamSync chat for gamemaster broadcasts
    const unsub = teamSync.subscribeToChat((msg: ChatMessage) => {
      if (seenMsgIdsRef.current.has(msg.id)) return;
      seenMsgIdsRef.current.add(msg.id);
      setChatMessages(prev => [...prev, msg]);
      const isFromMe = msg.id.includes(myDeviceId);
      if (!isFromMe) {
        playNotificationSound();
        setChatPopup(msg);
        setUnreadChat(prev => prev + 1);
      }
    });

    return () => {
      chatChannelReadyRef.current = false;
      chatChannelRef.current = null;
      supabase.removeChannel(channel);
      supabase.removeChannel(globalChannel);
      unsub();
    };
  }, [isOpen, game?.id, teamId]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadChat(0);
    }
  }, [chatMessages, activeTab]);

  // Subscribe to real-time DB changes for team members
  useEffect(() => {
    if (!isOpen || !teamId) return;

    // Use Supabase realtime subscription for team table changes
    const channel = supabase.channel(`team_${teamId}_changes`);

    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `id=eq.${teamId}`
      }, () => {
        // Reload team data when any change happens
        loadTeam();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, teamId, loadTeam]);

  // Generate QR code
  useEffect(() => {
    if (!isOpen || !team) return;
    const generateQr = async () => {
      const code = team.shortCode || team.id.slice(0, 6).toUpperCase();
      const accessCode = game?.accessCode || '';
      const url = `${window.location.origin}?teamCode=${code}&gameCode=${accessCode}`;
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: { dark: '#ffffff', light: '#00000000' }
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('[TeamLobbyView] QR generation failed:', err);
      }
    };
    generateQr();
  }, [isOpen, team, game]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !game?.timerConfig?.startTime) {
      setCountdown(null);
      return;
    }

    const tick = () => {
      const info = getCountdownState(
        game.timerConfig?.startTime,
        game.timerConfig?.lobbyOpenTime
      );
      setCountdown(info);
    };

    tick();
    countdownRef.current = window.setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
    };
  }, [isOpen, game]);

  // Refresh team data periodically (fallback for when realtime doesn't fire)
  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(() => loadTeam(), 15000);
    return () => window.clearInterval(interval);
  }, [isOpen, loadTeam]);

  const handleCopyCode = () => {
    const code = team?.shortCode || '';
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDisablePlayer = async (deviceId: string) => {
    if (!team) return;
    await db.setMemberDisabled(team.id, deviceId, true);
    // Also try broadcast for live players (may be no-op if teamSync not connected)
    teamSync.retirePlayer(deviceId);
    loadTeam();
  };

  const handleEnablePlayer = async (deviceId: string) => {
    if (!team) return;
    await db.setMemberDisabled(team.id, deviceId, false);
    teamSync.unretirePlayer(deviceId);
    loadTeam();
  };

  const handleRemoveMember = async (deviceId: string, memberName: string) => {
    if (!team) return;
    if (!confirm(`REMOVE ${memberName} FROM TEAM?`)) return;
    await db.removeTeamMember(team.id, deviceId);
    teamSync.broadcastMemberRemoved(deviceId, memberName);
    loadTeam();
  };

  const handlePromoteCaptain = async (deviceId: string, memberName: string) => {
    if (!team) return;
    if (!confirm(`MAKE ${memberName} CAPTAIN?`)) return;
    await db.updateTeamCaptain(team.id, deviceId);
    teamSync.broadcastCaptainChange(deviceId, memberName);
    loadTeam();
  };

  // Generate QR codes for voting tasks
  useEffect(() => {
    if (!isOpen || !game?.points || !team) return;
    const voteTasks = game.points.filter(p => p.teamVotingEnabled);
    if (voteTasks.length === 0) return;

    const generateQrs = async () => {
      const urls: Record<string, string> = {};
      for (const point of voteTasks) {
        const taskIndex = game.points.indexOf(point);
        const voteCode = generateTaskVoteCode(team.shortCode || '', taskIndex);
        const url = `${window.location.origin}?action=teamvote&gameCode=${game.accessCode || ''}&teamCode=${team.shortCode || ''}&taskId=${point.id}&voteCode=${voteCode}`;
        try {
          urls[point.id] = await QRCode.toDataURL(url, {
            width: 180, margin: 1,
            color: { dark: '#ffffff', light: '#00000000' }
          });
        } catch {}
      }
      setVoteQrDataUrls(urls);
    };
    generateQrs();
  }, [isOpen, game?.points, team]);

  // Captain: cast own vote for selected task
  const handleCaptainVote = (pointId: string) => {
    const point = game?.points?.find(p => p.id === pointId);
    if (!point) return;

    let finalAnswer: any = captainAnswer;
    if (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') {
      finalAnswer = captainSelectedOptions;
    } else if (point.task.type === 'slider') {
      finalAnswer = captainSliderValue;
    }

    teamSync.castVote(pointId, finalAnswer);
  };

  // Captain: submit selected team answer
  const handleSubmitTeamAnswer = (pointId: string) => {
    const point = game?.points?.find(p => p.id === pointId);
    if (!point || !onCompleteTask) return;

    const votes = taskVotes[pointId] || [];
    if (votes.length === 0) return;

    // Use captain's selected answer, or if consensus just use first vote
    let teamAnswer: any;
    if (captainSelectedAnswer) {
      // Find the vote with this answer
      const matchingVote = votes.find(v => {
        const ansStr = typeof v.answer === 'string' ? v.answer : JSON.stringify(v.answer);
        return ansStr === captainSelectedAnswer;
      });
      teamAnswer = matchingVote?.answer || votes[0].answer;
    } else {
      teamAnswer = votes[0].answer;
    }

    // Validate answer
    let isCorrect = false;
    if (point.task.type === 'multiple_choice' || point.task.type === 'boolean' || point.task.type === 'dropdown') {
      isCorrect = String(teamAnswer) === String(point.task.answer);
    } else if (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') {
      const correct = point.task.correctAnswers || [];
      const sortedSelected = [...(Array.isArray(teamAnswer) ? teamAnswer : [])].sort();
      const sortedCorrect = [...correct].sort();
      isCorrect = JSON.stringify(sortedSelected) === JSON.stringify(sortedCorrect);
    } else if (point.task.type === 'slider') {
      const val = Number(teamAnswer);
      const target = point.task.range?.correctValue || 0;
      const tolerance = point.task.range?.tolerance || 0;
      isCorrect = Math.abs(val - target) <= tolerance;
    } else {
      // Text comparison
      const val = String(teamAnswer).trim().toLowerCase();
      const correct = String(point.task.answer || '').trim().toLowerCase();
      isCorrect = val === correct;
    }

    const score = isCorrect
      ? (point.pointsOnCorrect ?? point.points)
      : (point.pointsOnIncorrect ?? 0);

    if (!confirm(`SUBMIT TEAM ANSWER: "${typeof teamAnswer === 'string' ? teamAnswer : JSON.stringify(teamAnswer)}"?\n\n${isCorrect ? '✓ CORRECT' : '✗ INCORRECT'} — ${score} PTS`)) return;

    onCompleteTask(pointId, score);
    setSelectedVoteTask(null);
    setCaptainSelectedAnswer(null);
  };

  // Captain: trigger revote
  const handleRevote = (pointId: string) => {
    if (!confirm('CLEAR ALL VOTES AND REQUEST REVOTE?')) return;
    teamSync.broadcastRevote(pointId);
    setCaptainSelectedAnswer(null);
  };

  const handleSendChat = () => {
    const msg = chatInput.trim();
    if (!msg || !game) return;

    const senderName = teamSync.getUserName() || 'Player';
    const teamName = team?.name || 'Team';

    const chatPayload: ChatMessage = {
      id: `msg-${Date.now()}-${myDeviceId}`,
      gameId: game.id,
      targetTeamId: null,
      message: msg,
      sender: `${teamName}: ${senderName}`,
      timestamp: Date.now(),
      isUrgent: false
    };

    // Mark as seen so we don't duplicate when self:true echoes it back
    seenMsgIdsRef.current.add(chatPayload.id);

    // Add locally for immediate feedback
    setChatMessages(prev => [...prev, chatPayload]);
    setChatInput('');

    // Send via our lobby chat channel (self:true will echo back, but we dedup)
    if (chatChannelRef.current && chatChannelReadyRef.current) {
      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: chatPayload
      });
    }

    // Also send via teamSync's global channel so gamemaster receives it
    teamSync.sendTeamChatMessage(game.id, msg, senderName, teamName);
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  if (!isOpen) return null;

  // Merge DB members with live status
  const mergedMembers: (TeamMemberData & { isOnline: boolean; isSolving?: boolean; isRetired?: boolean; deviceType?: string })[] =
    (team?.members || []).map(m => {
      const live = liveMembers.find(l => l.deviceId === m.deviceId);
      return {
        ...m,
        isOnline: !!live && (Date.now() - live.lastSeen < 60000),
        isSolving: live?.isSolving,
        // isDisabled from DB takes priority, fallback to live broadcast isRetired
        isRetired: m.isDisabled || live?.isRetired,
        deviceType: live?.deviceType
      };
    });

  // Sort: captain first, then online, then alphabetical
  mergedMembers.sort((a, b) => {
    const aIsCaptain = a.deviceId === team?.captainDeviceId ? 0 : 1;
    const bIsCaptain = b.deviceId === team?.captainDeviceId ? 0 : 1;
    if (aIsCaptain !== bIsCaptain) return aIsCaptain - bIsCaptain;
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const teamColor = team?.color || '#f97316';
  const shortCode = team?.shortCode || '';
  const onlineCount = mergedMembers.filter(m => m.isOnline).length;
  const activeMembers = mergedMembers.filter(m => !m.isRetired);

  // Helper: normalize vote answer for comparison
  const normalizeAnswer = (a: any) => {
    if (Array.isArray(a)) return JSON.stringify([...a].sort());
    if (typeof a === 'string') return a.trim().toLowerCase();
    if (typeof a === 'number' && Number.isFinite(a)) return String(a);
    if (a && typeof a === 'object') return JSON.stringify(a);
    return String(a);
  };

  const DeviceIcon = ({ type }: { type?: string }) => {
    if (type === 'tablet') return <Tablet className="w-4 h-4" />;
    if (type === 'desktop') return <Monitor className="w-4 h-4" />;
    return <Smartphone className="w-4 h-4" />;
  };

  // Get tasks that have voting enabled or have votes
  const votingTasks = (game?.points || []).filter(p => {
    const votes = taskVotes[p.id] || [];
    return p.teamVotingEnabled || votes.length > 0;
  });

  return (
    <div className="fixed inset-0 z-[5000] bg-[#0a0f1d] flex flex-col animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="bg-black/60 border-b-2 border-orange-500/30 px-4 py-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {/* LEFT: Team Name + Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border-2 shrink-0"
              style={{ backgroundColor: teamColor + '20', borderColor: teamColor + '60' }}
            >
              {team?.photoUrl ? (
                <img src={team.photoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
              ) : (
                <Users className="w-6 h-6" style={{ color: teamColor }} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-white uppercase tracking-wider truncate">
                {team?.name || 'LOADING...'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                {teamRank && (
                  <span className="text-xs text-orange-300 font-black uppercase tracking-wider">
                    RANK #{teamRank}/{totalTeams}
                  </span>
                )}
                <span className="text-xs text-slate-300 font-bold uppercase">
                  {onlineCount}/{mergedMembers.length} ONLINE
                </span>
                {shortCode && (
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border transition-colors"
                    style={{ color: '#fff', backgroundColor: teamColor + '25', borderColor: teamColor + '60' }}
                  >
                    {codeCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {shortCode}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: BIG SCORE BOX */}
          <div className="shrink-0 bg-black/60 border-2 border-orange-500/50 rounded-2xl px-6 py-2 flex flex-col items-center min-w-[180px]">
            <div className="flex items-center gap-2">
              <Trophy className="w-7 h-7 text-orange-400" />
              <span className="text-4xl font-black text-white tabular-nums tracking-tight">
                {team?.score || 0}
              </span>
              <span className="text-sm font-black text-orange-400 uppercase tracking-wider self-end mb-1">PTS</span>
            </div>
            {/* Task stats row */}
            {game?.points && (
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {team?.completedPointIds?.length || 0} CORRECT
                </span>
                <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  {Math.max(0, (game.points.length) - (team?.completedPointIds?.length || 0))} REMAINING
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadTeam()}
              className="p-3 hover:bg-orange-500/10 rounded-xl text-white hover:text-orange-400 transition-colors border border-white/10 hover:border-orange-500/30"
              title="Refresh"
            >
              <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-3 hover:bg-red-500/10 rounded-xl text-white hover:text-red-400 transition-colors border border-white/10 hover:border-red-500/30"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Bar — LARGE for tablet */}
      <div className="bg-black/30 border-b-2 border-orange-500/20 px-4 shrink-0">
        <div className="max-w-4xl mx-auto flex">
          {(['MEMBERS', 'VOTES', 'CHAT'] as LobbyTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'CHAT') setUnreadChat(0);
              }}
              className={`relative flex items-center gap-3 px-8 py-4 text-sm font-black uppercase tracking-widest transition-all border-b-4 ${
                activeTab === tab
                  ? 'text-orange-400 border-orange-500 bg-orange-500/10'
                  : 'text-slate-300 border-transparent hover:text-orange-300 hover:bg-orange-500/5'
              }`}
            >
              {tab === 'MEMBERS' && <Users className="w-5 h-5" />}
              {tab === 'VOTES' && <BarChart3 className="w-5 h-5" />}
              {tab === 'CHAT' && <MessageSquare className="w-5 h-5" />}
              {tab}
              {tab === 'MEMBERS' && (
                <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-black">
                  {mergedMembers.length}
                </span>
              )}
              {tab === 'VOTES' && votingTasks.length > 0 && (
                <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-black">
                  {votingTasks.length}
                </span>
              )}
              {tab === 'CHAT' && unreadChat > 0 && (
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-xs font-black rounded-full flex items-center justify-center animate-bounce">
                  {unreadChat}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">

          {/* ==================== MEMBERS TAB ==================== */}
          {activeTab === 'MEMBERS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* LEFT COLUMN: QR Code + Join Info */}
              <div className="space-y-4">
                {/* QR Code Card */}
                <div className="bg-black/30 border-2 border-orange-500/20 rounded-2xl p-5">
                  <button
                    onClick={() => setShowQrSection(!showQrSection)}
                    className="w-full flex items-center justify-between mb-3"
                  >
                    <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-orange-400" />
                      JOIN TEAM
                    </h2>
                    {showQrSection ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
                  </button>

                  {showQrSection && (
                    <div className="space-y-4">
                      {qrDataUrl && (
                        <div className="flex justify-center">
                          <div
                            className="p-3 rounded-2xl border-2"
                            style={{ backgroundColor: teamColor + '15', borderColor: teamColor + '40' }}
                          >
                            <img src={qrDataUrl} alt="Team QR Code" className="w-44 h-44" />
                          </div>
                        </div>
                      )}

                      {shortCode && (
                        <div className="text-center">
                          <p className="text-xs text-orange-300 font-black uppercase tracking-widest mb-2">TEAM CODE</p>
                          <button
                            onClick={handleCopyCode}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-3xl font-black tracking-[0.3em] transition-all border-2"
                            style={{ color: '#fff', backgroundColor: teamColor + '15', borderColor: teamColor + '50' }}
                          >
                            {shortCode}
                            {codeCopied ? <Check className="w-5 h-5 text-orange-400" /> : <Copy className="w-5 h-5 text-orange-400" />}
                          </button>
                        </div>
                      )}

                      <p className="text-center text-xs text-white font-bold uppercase tracking-wider">
                        SCAN QR OR ENTER CODE TO JOIN
                      </p>
                    </div>
                  )}
                </div>

                {/* Game Info Card */}
                {game && (
                  <div className="bg-black/30 border-2 border-orange-500/20 rounded-2xl p-5">
                    <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest mb-3">
                      GAME INFO
                    </h2>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300 font-bold uppercase">GAME</span>
                        <span className="text-sm text-white font-black uppercase truncate ml-4">{game.name}</span>
                      </div>
                      {game.accessCode && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-300 font-bold uppercase">ACCESS CODE</span>
                          <span className="text-sm text-white font-black tracking-wider">{game.accessCode}</span>
                        </div>
                      )}
                      {game.points && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-300 font-bold uppercase">TASKS</span>
                          <span className="text-sm text-white font-black">{game.points.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Countdown */}
                {countdown && countdown.state !== 'no_timer' && (
                  <div
                    className={`rounded-2xl p-5 text-center border-2 ${
                      countdown.state === 'game_started'
                        ? 'bg-orange-900/20 border-orange-500/40'
                        : countdown.state === 'lobby_open'
                        ? 'bg-orange-900/20 border-orange-500/50'
                        : 'bg-slate-900/50 border-slate-600/30'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Clock className={`w-5 h-5 ${
                        countdown.state === 'game_started' ? 'text-orange-400' :
                        countdown.state === 'lobby_open' ? 'text-orange-400 animate-pulse' :
                        'text-slate-300'
                      }`} />
                      <span className={`text-sm font-black uppercase tracking-widest ${
                        countdown.state === 'game_started' ? 'text-orange-400' :
                        countdown.state === 'lobby_open' ? 'text-orange-400' :
                        'text-white'
                      }`}>
                        {countdown.label}
                      </span>
                    </div>
                    {countdown.remainingMs > 0 ? (
                      <p className={`text-4xl font-black tracking-wider ${
                        countdown.state === 'lobby_open' ? 'text-white' : 'text-white'
                      }`}>
                        {formatCountdown(countdown.remainingMs)}
                      </p>
                    ) : (
                      <p className="text-2xl font-black text-orange-400 tracking-wider">
                        {countdown.label}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Member Roster */}
              <div className="space-y-4">
                {/* Active Members */}
                <div className="bg-black/30 border-2 border-orange-500/20 rounded-2xl p-5">
                  <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-400" />
                    ACTIVE MEMBERS ({activeMembers.length})
                    <span className="text-xs text-orange-300 ml-auto font-black">
                      {onlineCount} ONLINE
                    </span>
                  </h2>

                  <div className="space-y-2">
                    {mergedMembers.filter(m => !m.isRetired).map(member => {
                      const isMemberCaptain = member.deviceId === team?.captainDeviceId;
                      const isMe = member.deviceId === myDeviceId;
                      const isEditing = editingMember === member.deviceId;

                      return (
                        <div key={member.deviceId}>
                          <div
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                              isEditing ? 'bg-orange-500/10 border-orange-500/40' :
                              isMe ? 'bg-orange-500/5 border-orange-500/20' :
                              'border-white/10'
                            }`}
                          >
                            {/* Avatar */}
                            {member.photo ? (
                              <img src={member.photo} alt="" className="w-11 h-11 rounded-xl object-cover border-2 border-orange-500/30 shrink-0" />
                            ) : (
                              <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center border-2 shrink-0"
                                style={isMemberCaptain
                                  ? { backgroundColor: teamColor + '20', borderColor: teamColor + '50' }
                                  : { backgroundColor: '#1e293b', borderColor: '#475569' }
                                }
                              >
                                {isMemberCaptain
                                  ? <Crown className="w-5 h-5" style={{ color: teamColor }} />
                                  : <Users className="w-5 h-5 text-slate-300" />
                                }
                              </div>
                            )}

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white uppercase tracking-wider truncate">
                                  {member.name || 'UNKNOWN'}
                                </span>
                                {isMemberCaptain && (
                                  <span className="text-xs font-black uppercase px-1.5 py-0.5 rounded border" style={{ color: teamColor, backgroundColor: teamColor + '20', borderColor: teamColor + '40' }}>
                                    CPT
                                  </span>
                                )}
                                {isMe && (
                                  <span className="text-xs font-black text-orange-400 uppercase bg-orange-400/20 px-1.5 py-0.5 rounded border border-orange-500/30">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`flex items-center gap-1 text-xs font-black uppercase tracking-wider ${
                                  member.isOnline ? 'text-orange-400' : 'text-slate-400'
                                }`}>
                                  {member.isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                                  {member.isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                                {member.isSolving && (
                                  <span className="text-xs font-black text-orange-300 uppercase">SOLVING</span>
                                )}
                                {member.deviceType && member.isOnline && (
                                  <span className="text-slate-300"><DeviceIcon type={member.deviceType} /></span>
                                )}
                              </div>
                            </div>

                            {/* EDIT button */}
                            <button
                              onClick={() => setEditingMember(isEditing ? null : member.deviceId)}
                              className={`p-3 rounded-xl shrink-0 transition-colors border-2 ${
                                isEditing
                                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                                  : 'border-white/10 text-slate-300 hover:bg-orange-500/10 hover:border-orange-500/30 hover:text-orange-400'
                              }`}
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Inline actions when editing */}
                          {isEditing && (
                            <div className="flex flex-wrap gap-2 mt-2 ml-14 mb-1">
                              {!isMemberCaptain && (
                                <button
                                  onClick={() => { handlePromoteCaptain(member.deviceId, member.name); setEditingMember(null); }}
                                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-white/10 text-white border-2 border-white/30 hover:bg-orange-500/10 hover:border-orange-500/40 active:bg-orange-500/20 transition-colors"
                                >
                                  <Crown className="w-5 h-5 text-orange-400" /> PROMOTE
                                </button>
                              )}
                              <button
                                onClick={() => { handleDisablePlayer(member.deviceId); setEditingMember(null); }}
                                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-red-600/10 text-red-400 border-2 border-red-500/30 hover:bg-red-600/20 active:bg-red-600/30 transition-colors"
                              >
                                <UserX className="w-5 h-5" /> DISABLE
                              </button>
                              <button
                                onClick={() => { handleRemoveMember(member.deviceId, member.name); setEditingMember(null); }}
                                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-red-600/10 text-red-400 border-2 border-red-500/30 hover:bg-red-600/20 active:bg-red-600/30 transition-colors"
                              >
                                <Trash2 className="w-5 h-5" /> REMOVE
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Empty state */}
                    {mergedMembers.length === 0 && !loading && (
                      <div className="text-center py-8">
                        <Users className="w-12 h-12 text-orange-500/40 mx-auto mb-3" />
                        <p className="text-base font-black text-white uppercase tracking-wider">NO MEMBERS YET</p>
                        <p className="text-sm text-slate-300 font-bold uppercase mt-1">SHARE THE QR CODE TO INVITE</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Disabled Members Section */}
                {mergedMembers.filter(m => m.isRetired).length > 0 && (
                  <div className="bg-black/30 border-2 border-red-500/20 rounded-2xl p-5">
                    <h2 className="text-sm font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <UserX className="w-5 h-5 text-red-400" />
                      DISABLED ({mergedMembers.filter(m => m.isRetired).length})
                    </h2>

                    <div className="space-y-2">
                      {mergedMembers.filter(m => m.isRetired).map(member => (
                        <div
                          key={`disabled-${member.deviceId}`}
                          className="flex items-center gap-3 p-3 rounded-xl border-2 bg-red-900/10 border-red-500/20"
                        >
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center border-2 shrink-0 bg-slate-900/50 border-slate-700/30">
                            <UserX className="w-5 h-5 text-red-400/60" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-black text-slate-400 uppercase tracking-wider truncate line-through">
                              {member.name || 'UNKNOWN'}
                            </span>
                            <p className="text-xs font-bold text-red-400 uppercase mt-0.5">DISABLED</p>
                          </div>
                          <button
                            onClick={() => handleEnablePlayer(member.deviceId)}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-orange-600/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-600/30 active:bg-orange-600/40 transition-colors shrink-0"
                          >
                            <UserCheck className="w-5 h-5" /> ENABLE
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.deviceId, member.name)}
                            className="p-3 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-600/10 border-2 border-transparent hover:border-red-500/20 transition-colors shrink-0"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== VOTES TAB ==================== */}
          {activeTab === 'VOTES' && (() => {
            const selectedPoint = selectedVoteTask ? game?.points?.find(p => p.id === selectedVoteTask) : null;
            const selectedVotes = selectedVoteTask ? (taskVotes[selectedVoteTask] || []) : [];
            const activeCount = activeMembers.length || 1;

            // Check consensus for selected task
            let hasConsensus = false;
            let consensusAnswer: string | null = null;
            if (selectedVotes.length >= activeCount && selectedVotes.length > 0) {
              const firstNorm = normalizeAnswer(selectedVotes[0].answer);
              hasConsensus = selectedVotes.every(v => normalizeAnswer(v.answer) === firstNorm);
              if (hasConsensus) {
                consensusAnswer = typeof selectedVotes[0].answer === 'string'
                  ? selectedVotes[0].answer
                  : JSON.stringify(selectedVotes[0].answer);
              }
            }

            const votedDeviceIds = new Set(selectedVotes.map(v => v.deviceId));
            const notVoted = activeMembers.filter(m => !votedDeviceIds.has(m.deviceId));

            // Unique answers for captain selection
            const uniqueAnswers: { answer: string; count: number; voters: string[] }[] = [];
            selectedVotes.forEach(v => {
              const ansStr = typeof v.answer === 'string' ? v.answer : JSON.stringify(v.answer);
              const existing = uniqueAnswers.find(a => a.answer === ansStr);
              if (existing) { existing.count++; existing.voters.push(v.userName); }
              else uniqueAnswers.push({ answer: ansStr, count: 1, voters: [v.userName] });
            });
            uniqueAnswers.sort((a, b) => b.count - a.count);

            // Vote code for selected task
            const selectedTaskIndex = selectedPoint ? (game?.points?.indexOf(selectedPoint) ?? 0) : 0;
            const selectedVoteCode = selectedPoint ? generateTaskVoteCode(team?.shortCode || '', selectedTaskIndex) : '';

            // Voting mode
            const votingMode = selectedPoint?.teamVotingMode || game?.taskConfig?.teamVotingMode || 'captain_submit';

            return (
              <div className="space-y-3">
                {votingTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <BarChart3 className="w-14 h-14 text-orange-500/30 mx-auto mb-3" />
                    <p className="text-base font-black text-white uppercase tracking-wider">NO ACTIVE VOTES</p>
                    <p className="text-sm text-slate-300 font-bold uppercase mt-2">
                      TASKS WITH TEAM VOTING ENABLED WILL APPEAR HERE
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Task pills - horizontal scrollable */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {votingTasks.map((point, idx) => {
                        const votes = taskVotes[point.id] || [];
                        const isSelected = selectedVoteTask === point.id;
                        const taskVoteCode = generateTaskVoteCode(team?.shortCode || '', game?.points?.indexOf(point) ?? idx);
                        const taskActiveCount = activeMembers.length || 1;
                        const taskHasConsensus = votes.length >= taskActiveCount && votes.length > 0 &&
                          votes.every(v => normalizeAnswer(v.answer) === normalizeAnswer(votes[0].answer));

                        return (
                          <button
                            key={point.id}
                            onClick={() => {
                              setSelectedVoteTask(isSelected ? null : point.id);
                              setCaptainAnswer('');
                              setCaptainSelectedOptions([]);
                              setCaptainSelectedAnswer(null);
                            }}
                            className={`shrink-0 px-4 py-3 rounded-xl border-2 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                              isSelected
                                ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                                : taskHasConsensus
                                ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
                                : votes.length > 0
                                ? 'bg-white/5 border-orange-500/20 text-white'
                                : 'bg-white/5 border-white/10 text-slate-300'
                            }`}
                          >
                            {taskHasConsensus ? <CheckCircle className="w-4 h-4" /> :
                             votes.length > 0 ? <AlertCircle className="w-4 h-4 animate-pulse" /> :
                             <Circle className="w-4 h-4" />}
                            <span className="truncate max-w-[120px]">{point.title || taskVoteCode}</span>
                            <span className="text-orange-300">{votes.length}/{taskActiveCount}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected task detail view */}
                    {selectedPoint ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* LEFT: Task Preview */}
                        <div className="bg-black/30 border-2 border-orange-500/20 rounded-2xl p-5 space-y-4">
                          <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            TASK PREVIEW
                          </h2>

                          <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">
                              {selectedPoint.title || 'UNTITLED TASK'}
                            </h3>
                            <p className="text-xs text-orange-300 font-bold uppercase mt-1">
                              {selectedPoint.points} PTS · {selectedPoint.task.type.toUpperCase().replace('_', ' ')} · {votingMode === 'require_consensus' ? 'CONSENSUS REQUIRED' : 'CAPTAIN SUBMIT'}
                            </p>
                          </div>

                          {/* Question text */}
                          {selectedPoint.task.question && (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <p className="text-sm text-white font-bold leading-relaxed"
                                 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedPoint.task.question) }} />
                            </div>
                          )}

                          {/* Task image */}
                          {selectedPoint.task.imageUrl && (
                            <img src={selectedPoint.task.imageUrl} alt="Task" className="w-full h-auto max-h-48 object-contain rounded-xl border-2 border-white/10" />
                          )}

                          {/* Captain answer input */}
                          <div className="space-y-2">
                            <p className="text-xs font-black text-orange-400 uppercase tracking-widest">YOUR VOTE (CAPTAIN)</p>

                            {/* Multiple choice */}
                            {selectedPoint.task.type === 'multiple_choice' && selectedPoint.task.options?.map((opt, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setCaptainAnswer(opt)}
                                className={`w-full p-3 rounded-xl border-2 text-left text-sm font-bold uppercase tracking-wider transition-all ${
                                  captainAnswer === opt
                                    ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                                    : 'border-white/10 text-white hover:bg-white/5'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}

                            {/* Boolean */}
                            {selectedPoint.task.type === 'boolean' && (
                              <div className="flex gap-2">
                                <button onClick={() => setCaptainAnswer('true')}
                                  className={`flex-1 p-3 rounded-xl border-2 font-black uppercase text-sm ${captainAnswer === 'true' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-white/10 text-white'}`}>
                                  TRUE
                                </button>
                                <button onClick={() => setCaptainAnswer('false')}
                                  className={`flex-1 p-3 rounded-xl border-2 font-black uppercase text-sm ${captainAnswer === 'false' ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-white/10 text-white'}`}>
                                  FALSE
                                </button>
                              </div>
                            )}

                            {/* Text */}
                            {selectedPoint.task.type === 'text' && (
                              <input
                                type="text"
                                value={captainAnswer}
                                onChange={e => setCaptainAnswer(e.target.value)}
                                placeholder="TYPE YOUR ANSWER..."
                                className="w-full px-4 py-3 rounded-xl border-2 border-white/20 bg-white/5 text-white font-bold uppercase placeholder:text-slate-400 focus:border-orange-500 outline-none"
                              />
                            )}

                            {/* Dropdown */}
                            {selectedPoint.task.type === 'dropdown' && (
                              <select
                                value={captainAnswer}
                                onChange={e => setCaptainAnswer(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-white/20 bg-slate-900 text-white font-bold uppercase focus:border-orange-500 outline-none"
                              >
                                <option value="">SELECT...</option>
                                {selectedPoint.task.options?.map((opt, idx) => (
                                  <option key={idx} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}

                            {/* Checkbox / multi-select */}
                            {(selectedPoint.task.type === 'checkbox' || selectedPoint.task.type === 'multi_select_dropdown') && selectedPoint.task.options?.map((opt, idx) => (
                              <label key={idx} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                captainSelectedOptions.includes(opt) ? 'border-orange-500 bg-orange-500/20' : 'border-white/10 hover:bg-white/5'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={captainSelectedOptions.includes(opt)}
                                  onChange={e => {
                                    if (e.target.checked) setCaptainSelectedOptions(prev => [...prev, opt]);
                                    else setCaptainSelectedOptions(prev => prev.filter(o => o !== opt));
                                  }}
                                  className="w-5 h-5 rounded border-2 accent-orange-500"
                                />
                                <span className="text-sm font-bold text-white uppercase">{opt}</span>
                              </label>
                            ))}

                            {/* Slider */}
                            {selectedPoint.task.type === 'slider' && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-400">{selectedPoint.task.range?.min || 0}</span>
                                  <span className="text-2xl font-black text-orange-400">{captainSliderValue}</span>
                                  <span className="text-xs font-bold text-slate-400">{selectedPoint.task.range?.max || 100}</span>
                                </div>
                                <input
                                  type="range"
                                  min={selectedPoint.task.range?.min || 0}
                                  max={selectedPoint.task.range?.max || 100}
                                  step={selectedPoint.task.range?.step || 1}
                                  value={captainSliderValue}
                                  onChange={e => setCaptainSliderValue(parseInt(e.target.value))}
                                  className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-orange-500 bg-slate-700"
                                />
                              </div>
                            )}

                            {/* Cast vote button */}
                            <button
                              onClick={() => handleCaptainVote(selectedPoint.id)}
                              disabled={!captainAnswer && captainSelectedOptions.length === 0 && selectedPoint.task.type !== 'slider'}
                              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                              <Vote className="w-5 h-5" /> CAST MY VOTE
                            </button>
                          </div>

                          {/* QR Code + Vote Code */}
                          <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center gap-4">
                            {voteQrDataUrls[selectedPoint.id] && (
                              <img src={voteQrDataUrls[selectedPoint.id]} alt="Vote QR" className="w-24 h-24 rounded-lg" />
                            )}
                            <div>
                              <p className="text-xs text-orange-400 font-black uppercase tracking-widest">VOTE CODE</p>
                              <p className="text-3xl font-black text-white tracking-[0.2em] mt-1">{selectedVoteCode}</p>
                              <p className="text-xs text-slate-300 font-bold uppercase mt-1">SCAN QR OR ENTER CODE TO VOTE</p>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Member Votes */}
                        <div className="bg-black/30 border-2 border-orange-500/20 rounded-2xl p-5 space-y-4">
                          <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            MEMBER VOTES
                            <span className="ml-auto text-xs text-orange-300">
                              {selectedVotes.length}/{activeCount} VOTED
                            </span>
                          </h2>

                          {/* Progress bar */}
                          <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-orange-500/20">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                hasConsensus ? 'bg-emerald-500' : 'bg-orange-500'
                              }`}
                              style={{ width: `${Math.min(selectedVotes.length / activeCount, 1) * 100}%` }}
                            />
                          </div>

                          {/* Consensus indicator */}
                          {hasConsensus && consensusAnswer && (
                            <div className="p-4 bg-emerald-900/20 border-2 border-emerald-500/40 rounded-xl">
                              <p className="text-xs text-emerald-400 font-black uppercase tracking-widest mb-1">CONSENSUS REACHED</p>
                              <p className="text-lg text-white font-black">{consensusAnswer}</p>
                            </div>
                          )}

                          {/* Individual votes */}
                          <div className="space-y-2">
                            {selectedVotes.map(vote => (
                              <div
                                key={vote.deviceId}
                                onClick={() => setCaptainSelectedAnswer(
                                  typeof vote.answer === 'string' ? vote.answer : JSON.stringify(vote.answer)
                                )}
                                className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                  captainSelectedAnswer === (typeof vote.answer === 'string' ? vote.answer : JSON.stringify(vote.answer))
                                    ? 'bg-orange-500/20 border-orange-500/50'
                                    : 'bg-white/5 border-white/10 hover:border-orange-500/30'
                                }`}
                              >
                                <CheckCircle className="w-5 h-5 text-orange-400 shrink-0" />
                                <span className="text-sm font-black text-white uppercase tracking-wider flex-1 truncate">
                                  {vote.userName}
                                </span>
                                <span className="text-sm text-orange-300 font-bold truncate max-w-[160px]">
                                  {typeof vote.answer === 'string' ? vote.answer : JSON.stringify(vote.answer)}
                                </span>
                              </div>
                            ))}

                            {/* Waiting for */}
                            {notVoted.length > 0 && (
                              <>
                                <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-3">WAITING FOR</p>
                                {notVoted.map(m => (
                                  <div key={m.deviceId} className="flex items-center gap-2 p-3 bg-slate-900/30 rounded-xl border border-slate-600/20 opacity-50">
                                    <Circle className="w-5 h-5 text-slate-400 shrink-0" />
                                    <span className="text-sm font-bold text-white uppercase">{m.name || 'UNKNOWN'}</span>
                                    <span className="text-xs text-slate-400 ml-auto font-bold uppercase">
                                      {m.isOnline ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>

                          {/* Answer distribution summary */}
                          {uniqueAnswers.length > 1 && (
                            <div className="space-y-1">
                              <p className="text-xs text-orange-400 font-black uppercase tracking-widest">ANSWER DISTRIBUTION</p>
                              {uniqueAnswers.map((ua, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <div className="h-3 bg-orange-500/60 rounded-full" style={{ width: `${(ua.count / selectedVotes.length) * 100}%`, minWidth: '20px' }} />
                                  <span className="text-white font-bold truncate">{ua.answer}</span>
                                  <span className="text-orange-300 font-black shrink-0">{ua.count}x</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Captain Controls */}
                          {isCaptain && selectedVotes.length > 0 && (
                            <div className="border-t-2 border-orange-500/20 pt-4 space-y-3">
                              <p className="text-xs font-black text-orange-400 uppercase tracking-widest">CAPTAIN CONTROLS</p>

                              {/* Select answer dropdown */}
                              {uniqueAnswers.length > 0 && (
                                <select
                                  value={captainSelectedAnswer || ''}
                                  onChange={e => setCaptainSelectedAnswer(e.target.value || null)}
                                  className="w-full px-4 py-3 rounded-xl border-2 border-orange-500/30 bg-slate-900 text-white font-bold uppercase text-sm focus:border-orange-500 outline-none"
                                >
                                  <option value="">SELECT TEAM ANSWER...</option>
                                  {uniqueAnswers.map((ua, idx) => (
                                    <option key={idx} value={ua.answer}>
                                      {ua.answer} ({ua.count} VOTES)
                                    </option>
                                  ))}
                                </select>
                              )}

                              <div className="flex gap-2">
                                {/* Submit button */}
                                <button
                                  onClick={() => handleSubmitTeamAnswer(selectedPoint.id)}
                                  disabled={votingMode === 'require_consensus' && !hasConsensus}
                                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                  <CheckCircle className="w-5 h-5" /> SUBMIT TEAM ANSWER
                                </button>

                                {/* Revote button */}
                                <button
                                  onClick={() => handleRevote(selectedPoint.id)}
                                  className="px-4 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 font-black uppercase tracking-wider text-sm border-2 border-red-500/30 transition-colors flex items-center gap-2"
                                >
                                  <RotateCcw className="w-5 h-5" /> REVOTE
                                </button>
                              </div>

                              {votingMode === 'require_consensus' && !hasConsensus && (
                                <p className="text-xs text-red-400 font-bold uppercase text-center">
                                  CONSENSUS REQUIRED — ALL MEMBERS MUST AGREE BEFORE SUBMIT
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* No task selected — show list */
                      <div className="space-y-2">
                        <p className="text-xs text-orange-400 font-black uppercase tracking-widest">SELECT A TASK TO VIEW DETAILS</p>
                        {votingTasks.map(point => {
                          const votes = taskVotes[point.id] || [];
                          const taskIdx = game?.points?.indexOf(point) ?? 0;
                          const voteCode = generateTaskVoteCode(team?.shortCode || '', taskIdx);
                          return (
                            <button
                              key={point.id}
                              onClick={() => setSelectedVoteTask(point.id)}
                              className="w-full p-4 flex items-center gap-3 text-left bg-black/30 border-2 border-orange-500/20 rounded-xl hover:bg-orange-500/5 transition-colors"
                            >
                              {votes.length >= activeCount && votes.every(v => normalizeAnswer(v.answer) === normalizeAnswer(votes[0]?.answer))
                                ? <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                                : votes.length > 0
                                ? <AlertCircle className="w-6 h-6 text-orange-300 shrink-0 animate-pulse" />
                                : <Circle className="w-6 h-6 text-slate-400 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-white uppercase truncate">{point.title || 'UNTITLED'}</p>
                                <p className="text-xs text-orange-300 font-bold uppercase mt-0.5">
                                  {votes.length}/{activeCount} VOTED · CODE: {voteCode}
                                </p>
                              </div>
                              <ChevronDown className="w-5 h-5 text-white shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* ==================== CHAT TAB ==================== */}
          {activeTab === 'CHAT' && (
            <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-16">
                    <MessageSquare className="w-14 h-14 text-orange-500/30 mx-auto mb-3" />
                    <p className="text-base font-black text-white uppercase tracking-wider">NO MESSAGES YET</p>
                    <p className="text-sm text-slate-300 font-bold uppercase mt-2">
                      MESSAGES FROM GAMEMASTER AND TEAM WILL APPEAR HERE
                    </p>
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isFromMe = msg.id.includes(myDeviceId);
                    const isFromInstructor = msg.sender === 'Instructor' || msg.sender === 'Gamemaster';

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 border-2 ${
                          isFromInstructor
                            ? 'bg-orange-900/30 border-orange-500/40'
                            : isFromMe
                            ? 'bg-white/10 border-orange-500/20'
                            : 'bg-slate-800/50 border-slate-600/30'
                        }`}>
                          <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                            isFromInstructor ? 'text-orange-400' :
                            isFromMe ? 'text-orange-300' : 'text-white'
                          }`}>
                            {isFromInstructor && <Shield className="w-3.5 h-3.5 inline mr-1" />}
                            {msg.sender}
                          </p>
                          <p className={`text-sm font-bold ${
                            msg.isUrgent ? 'text-orange-300' : 'text-white'
                          }`}>
                            {msg.message}
                          </p>
                          <p className="text-xs text-slate-300 font-bold mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t-2 border-orange-500/20 pt-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyPress}
                    placeholder="TYPE A MESSAGE..."
                    className="flex-1 bg-black/30 border-2 border-orange-500/20 rounded-xl px-4 py-4 text-sm text-white font-bold uppercase tracking-wider placeholder:text-slate-400 outline-none focus:border-orange-500/60 transition-colors"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim()}
                    className="px-6 py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-black uppercase tracking-wider transition-colors flex items-center gap-2 border-2 border-orange-500 disabled:border-slate-700"
                  >
                    <Send className="w-5 h-5" />
                    SEND
                  </button>
                </div>
                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mt-2 text-center">
                  MESSAGES ARE VISIBLE TO GAMEMASTER AND ALL TEAMS
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat notification popup */}
      {chatPopup && (
        <MessagePopup
          message={chatPopup.message}
          sender={chatPopup.sender}
          onClose={() => setChatPopup(null)}
          isUrgent={chatPopup.isUrgent}
        />
      )}

      {/* Loading overlay */}
      {loading && !team && (
        <div className="absolute inset-0 bg-[#0a0f1d] flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-14 h-14 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-lg text-white font-black uppercase tracking-wider">LOADING TEAM...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLobbyView;
