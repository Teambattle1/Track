import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Users, Shield, Crown, UserX, UserCheck, UserPlus,
  QrCode, Copy, Check, RefreshCw, Clock, Wifi, WifiOff,
  Smartphone, Tablet, Monitor, Trophy, ChevronDown, ChevronUp,
  Trash2, MessageSquare, BarChart3, Send, CheckCircle, Circle,
  AlertCircle, Eye, Play, Key, Info, Pencil, Radio, Megaphone, AlertTriangle
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { Team, Game, TeamMember, TeamMemberData, TaskVote, ChatMessage, GameMessage } from '../types';
import { teamSync } from '../services/teamSync';
import * as db from '../services/db';
import { getCountdownState, formatCountdown, CountdownInfo } from '../utils/teamUtils';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';

type LobbyTab = 'MEMBERS' | 'VOTES' | 'CHAT';

interface TeamLobbyViewProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  game?: Game;
  allTeams?: Team[];
  isCaptain?: boolean;
  onStartGame?: () => void;
  autoOpenVotesForPoint?: string | null;
  onTaskDecided?: (pointId: string) => void;
}

const TeamLobbyView: React.FC<TeamLobbyViewProps> = ({
  isOpen,
  onClose,
  teamId,
  game,
  allTeams,
  isCaptain: isCaptainProp,
  onStartGame,
  autoOpenVotesForPoint,
  onTaskDecided
}) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [liveMembers, setLiveMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [countdown, setCountdown] = useState<CountdownInfo | null>(null);
  const [showMemberActions, setShowMemberActions] = useState<string | null>(null);
  const [showQrSection, setShowQrSection] = useState(true);
  const [activeTab, setActiveTab] = useState<LobbyTab>('MEMBERS');
  const countdownRef = useRef<number | null>(null);
  const autoStartFiredRef = useRef(false);
  const lastBeepSecondRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const myDeviceId = teamSync.getDeviceId();

  // --- VOTE STATE ---
  const [taskVotes, setTaskVotes] = useState<Record<string, TaskVote[]>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // --- CHAT STATE ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatRecipient, setChatRecipient] = useState<'gamemaster' | 'all' | string>('gamemaster'); // 'gamemaster', 'all', or a team id
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [gameTeams, setGameTeams] = useState<Team[]>([]);
  const [showSendAllWarning, setShowSendAllWarning] = useState(false);
  const [confirmReadMessages, setConfirmReadMessages] = useState<ChatMessage[]>([]);
  const [confirmedMessageIds, setConfirmedMessageIds] = useState<Set<string>>(new Set());

  // --- REJOIN REQUEST STATE (captain only) ---
  const [rejoinRequest, setRejoinRequest] = useState<{
    requestId: string;
    teamId: string;
    teamName: string;
    playerName: string;
    newDeviceId: string;
    timestamp: number;
  } | null>(null);
  const [rejoinShowMerge, setRejoinShowMerge] = useState(false);
  const [rejoinShowRetire, setRejoinShowRetire] = useState(false);

  // --- RECOVERY CODES STATE (captain only) ---
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<Record<string, string>>({}); // deviceId -> code
  const [recoveryCodesLoading, setRecoveryCodesLoading] = useState(false);
  const [copiedRecoveryCode, setCopiedRecoveryCode] = useState<string | null>(null);

  // --- LOADING FUN TEXT STATE ---
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  // --- EDIT NAME STATE ---
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [editTeamNameValue, setEditTeamNameValue] = useState('');
  const [editTeamNameError, setEditTeamNameError] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(null); // deviceId of member being edited
  const [editPlayerNameValue, setEditPlayerNameValue] = useState('');
  const [editPlayerNameError, setEditPlayerNameError] = useState<string | null>(null);

  // Determine captain status
  const isCaptain = isCaptainProp ?? (team?.captainDeviceId === myDeviceId);

  // Calculate rank
  const teamRank = allTeams && team
    ? [...allTeams].sort((a, b) => b.score - a.score).findIndex(t => t.id === team.id) + 1
    : null;
  const totalTeams = allTeams?.length || 0;

  // Load team data from DB (try by ID first, then by name within the game)
  const loadTeam = useCallback(async (retryCount = 0): Promise<void> => {
    try {
      let data: Team | null = null;
      // Try by ID first (only if teamId looks like a real DB id, not a name)
      if (teamId && teamId.startsWith('team-')) {
        data = await db.fetchTeam(teamId);
      }
      // Fallback: look up by name within the game
      if (!data && game?.id) {
          const teamState = teamSync.getState();
          const nameToSearch = teamState.teamName || teamId;
          if (nameToSearch) {
              const allGameTeams = await db.fetchTeams(game.id);
              data = allGameTeams.find(t => t.name.toLowerCase() === nameToSearch.toLowerCase()) || null;
          }
      }
      if (data) {
        setTeam(data);
        setLoading(false);
      } else if (retryCount < 5) {
        // Team may still be registering in DB — retry after a short delay
        setTimeout(() => loadTeam(retryCount + 1), 800);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('[TeamLobbyView] Error loading team:', err);
      if (retryCount < 5) {
        setTimeout(() => loadTeam(retryCount + 1), 800);
      } else {
        setLoading(false);
      }
    }
  }, [teamId, game?.id]);

  useEffect(() => {
    if (!isOpen) return;
    loadTeam();
  }, [isOpen, teamId, loadTeam]);

  // Lock landscape orientation for captain tablet view
  useEffect(() => {
    if (!isOpen) return;
    try {
      (window.screen as any).orientation?.lock?.('landscape-primary')?.catch?.(() => {});
    } catch {}
    return () => {
      try { (window.screen as any).orientation?.unlock?.(); } catch {}
    };
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

  // Subscribe to chat messages
  useEffect(() => {
    if (!isOpen) return;
    const unsub = teamSync.subscribeToChat((msg: ChatMessage) => {
      // Filter: only show messages targeted to this team, gamemaster messages, or broadcast messages
      const myTeamName = team?.name?.toLowerCase();
      const isForMe =
        !msg.targetTeamId || // broadcast
        msg.targetTeamId === team?.id || // targeted to this team by ID
        msg.targetTeamId === 'gamemaster' || // gamemaster messages (visible to all)
        msg.sender === 'Instructor' || msg.sender === 'Gamemaster' || // from instructor
        msg.senderTeamName?.toLowerCase() === myTeamName; // from our own team

      if (!isForMe) return;

      setChatMessages(prev => [...prev, msg]);
      if (activeTab !== 'CHAT') {
        setUnreadChat(prev => prev + 1);
      }

      // If confirm required, add to confirm queue
      if (msg.confirmRequired && msg.sender !== `${team?.name}: ${teamSync.getUserName()}`) {
        setConfirmReadMessages(prev => [...prev, msg]);
      }
    });
    return unsub;
  }, [isOpen, activeTab, team?.name, team?.id]);

  // Fetch all teams for recipient selector
  useEffect(() => {
    if (!isOpen || !game?.id) return;
    const fetchTeams = async () => {
      try {
        const teams = await db.fetchTeams(game.id);
        setGameTeams(teams.filter(t => t.id !== team?.id)); // exclude own team
      } catch (e) {
        console.error('[TeamLobbyView] Error fetching teams for chat:', e);
      }
    };
    fetchTeams();
  }, [isOpen, game?.id, team?.id]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadChat(0);
    }
  }, [chatMessages, activeTab]);

  // Subscribe to rejoin requests (captain only)
  useEffect(() => {
    if (!isOpen || !isCaptain || !game?.id || !team?.name) return;
    const unsub = teamSync.subscribeToRejoinRequests(game.id, team.name, (request) => {
      console.log('[TeamLobbyView] Received rejoin request:', request);
      setRejoinRequest(request);
      setRejoinShowMerge(false);
      setRejoinShowRetire(false);
    });
    return unsub;
  }, [isOpen, isCaptain, game?.id, team?.name]);

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

  // Beep sound using Web Audio API
  const playBeep = useCallback((frequency: number = 800, duration: number = 150, volume: number = 0.3) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'square';
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      // Audio not available
    }
  }, []);

  // Countdown timer with 10-second beep and auto-start
  useEffect(() => {
    if (!isOpen || !game?.timerConfig?.startTime) {
      setCountdown(null);
      autoStartFiredRef.current = false;
      lastBeepSecondRef.current = null;
      return;
    }

    const tick = () => {
      const info = getCountdownState(
        game.timerConfig?.startTime,
        game.timerConfig?.lobbyOpenTime
      );
      setCountdown(info);

      // 10-second countdown beeps + auto-start for captain
      if (isCaptain && onStartGame && info.state === 'lobby_open') {
        const secondsLeft = Math.ceil(info.remainingMs / 1000);

        if (secondsLeft <= 10 && secondsLeft > 0 && secondsLeft !== lastBeepSecondRef.current) {
          lastBeepSecondRef.current = secondsLeft;
          // Higher pitch + louder for last 3 seconds
          if (secondsLeft <= 3) {
            playBeep(1200, 200, 0.5);
          } else {
            playBeep(800, 150, 0.3);
          }
        }
      }

      // Auto-start when countdown reaches zero
      if (isCaptain && onStartGame && info.state === 'game_started' && !autoStartFiredRef.current) {
        autoStartFiredRef.current = true;
        // Final long beep
        playBeep(1400, 500, 0.6);
        // Small delay so the final beep plays before navigation
        setTimeout(() => {
          onStartGame();
        }, 600);
      }
    };

    tick();
    countdownRef.current = window.setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
    };
  }, [isOpen, game, isCaptain, onStartGame, playBeep]);

  // Auto-switch to VOTES tab when a voting task is opened by captain
  useEffect(() => {
    if (autoOpenVotesForPoint && isOpen) {
      setActiveTab('VOTES');
      setExpandedTask(autoOpenVotesForPoint);
    }
  }, [autoOpenVotesForPoint, isOpen]);

  // Fun loading text rotation
  const funLoadingTexts = [
    'Cleaning up the lobby from previous guests...',
    'Painting the walls so it looks nice...',
    'Setting up the scoreboard...',
    'Polishing the trophies...',
    'Warming up the game engine...',
    'Rolling out the red carpet...',
    'Checking the weather forecast...',
    'Tuning the radio...',
    'Sharpening the pencils...',
    'Brewing coffee for the team...',
    'Loading secret missions...',
    'Calibrating GPS satellites...',
    'Counting team members twice...',
    'Stretching before the race...',
    'Almost there, hang tight!'
  ];

  useEffect(() => {
    if (!loading || team) return;
    const interval = window.setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % funLoadingTexts.length);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [loading, team]);

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

  // Load recovery codes for all team members
  const handleShowRecoveryCodes = async () => {
    if (!game?.id) return;
    setShowRecoveryCodes(true);
    setRecoveryCodesLoading(true);
    try {
      const codes = await db.fetchRecoveryCodesForGame(game.id);
      const codeMap: Record<string, string> = {};
      for (const c of codes) {
        codeMap[c.deviceId] = c.code;
      }
      setRecoveryCodes(codeMap);
    } catch (e) {
      console.error('[TeamLobbyView] Error loading recovery codes:', e);
    } finally {
      setRecoveryCodesLoading(false);
    }
  };

  const handleCopyRecoveryCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedRecoveryCode(code);
    setTimeout(() => setCopiedRecoveryCode(null), 2000);
  };

  // --- EDIT TEAM NAME ---
  const handleStartEditTeamName = () => {
    if (!isCaptain || !team) return;
    setEditTeamNameValue(team.name);
    setEditTeamNameError(null);
    setEditingTeamName(true);
  };

  const handleSaveTeamName = async () => {
    if (!team || !game?.id) return;
    const newName = editTeamNameValue.trim();
    if (!newName) { setEditTeamNameError('Name cannot be empty'); return; }
    if (newName === team.name) { setEditingTeamName(false); return; }
    // Check for duplicate team name
    const allGameTeams = await db.fetchTeams(game.id);
    const dup = allGameTeams.find(t => t.id !== team.id && t.name.toLowerCase() === newName.toLowerCase());
    if (dup) { setEditTeamNameError(`Team "${dup.name}" already exists`); return; }
    await db.updateTeam(team.id, { name: newName });
    setEditingTeamName(false);
    loadTeam();
  };

  // --- EDIT PLAYER NAME ---
  const handleStartEditPlayerName = (deviceId: string, currentName: string) => {
    setEditPlayerNameValue(currentName);
    setEditPlayerNameError(null);
    setEditingPlayerName(deviceId);
  };

  const handleSavePlayerName = async () => {
    if (!team || !editingPlayerName) return;
    const newName = editPlayerNameValue.trim();
    if (!newName) { setEditPlayerNameError('Name cannot be empty'); return; }
    const currentMember = team.members.find(m => m.deviceId === editingPlayerName);
    if (currentMember && currentMember.name === newName) { setEditingPlayerName(null); return; }
    // Check for duplicate player name within the team
    const dup = team.members.find(m => m.deviceId !== editingPlayerName && m.name.toLowerCase() === newName.toLowerCase());
    if (dup) { setEditPlayerNameError(`Player "${dup.name}" already exists on this team`); return; }
    const updatedMembers = team.members.map(m =>
      m.deviceId === editingPlayerName ? { ...m, name: newName } : m
    );
    await db.updateTeam(team.id, { members: updatedMembers });
    setEditingPlayerName(null);
    loadTeam();
  };

  const handleRetirePlayer = (deviceId: string) => {
    if (!isCaptain) return;
    teamSync.retirePlayer(deviceId);
  };

  const handleUnretirePlayer = (deviceId: string) => {
    if (!isCaptain) return;
    teamSync.unretirePlayer(deviceId);
  };

  const handleRemoveMember = async (deviceId: string, memberName: string) => {
    if (!isCaptain || !team) return;
    if (!confirm(`Remove ${memberName} from the team?`)) return;
    await db.removeTeamMember(team.id, deviceId);
    teamSync.broadcastMemberRemoved(deviceId, memberName);
    loadTeam();
    setShowMemberActions(null);
  };

  const handlePromoteCaptain = async (deviceId: string, memberName: string) => {
    if (!isCaptain || !team) return;
    if (!confirm(`Make ${memberName} captain?`)) return;
    await db.updateTeamCaptain(team.id, deviceId);
    teamSync.broadcastCaptainChange(deviceId, memberName);
    loadTeam();
    setShowMemberActions(null);
  };

  const handleSendChat = (forceSendAll = false) => {
    const msg = chatInput.trim();
    if (!msg || !game) return;

    // If sending to all, show warning first (unless forced)
    if (chatRecipient === 'all' && !forceSendAll) {
      setShowSendAllWarning(true);
      return;
    }

    const targetId = chatRecipient === 'gamemaster' ? 'gamemaster' : chatRecipient === 'all' ? null : chatRecipient;
    const myTeamName = team?.name || 'Team';

    // Send via teamSync's global channel
    teamSync.sendTeamChatMessage(game.id, msg, teamSync.getUserName(), myTeamName, targetId);

    // Add locally for immediate feedback
    const chatPayload: ChatMessage = {
      id: `msg-${Date.now()}-${myDeviceId}`,
      gameId: game.id,
      targetTeamId: targetId,
      message: msg,
      sender: `${myTeamName}: ${teamSync.getUserName()}`,
      senderTeamName: myTeamName,
      timestamp: Date.now(),
      isUrgent: false
    };
    setChatMessages(prev => [...prev, chatPayload]);
    setChatInput('');
    setShowSendAllWarning(false);
  };

  const handleConfirmRead = (messageId: string) => {
    if (!game) return;
    teamSync.sendConfirmRead(game.id, messageId, team?.name || 'Team');
    setConfirmedMessageIds(prev => new Set([...prev, messageId]));
    setConfirmReadMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const getRecipientLabel = () => {
    if (chatRecipient === 'gamemaster') return 'GAMEMASTER';
    if (chatRecipient === 'all') return 'ALL TEAMS';
    const t = gameTeams.find(t => t.id === chatRecipient);
    return t ? t.name : 'SELECT RECIPIENT';
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  // --- REJOIN REQUEST HANDLERS ---
  const handleAcceptRejoin = () => {
    if (!rejoinRequest) return;
    // Show merge prompt
    setRejoinShowMerge(true);
  };

  const handleRejectRejoin = () => {
    if (!rejoinRequest) return;
    // Show retire prompt
    setRejoinShowRetire(true);
  };

  const handleMergeWith = async (oldDeviceId: string) => {
    if (!rejoinRequest || !team || !game) return;
    // Merge: transfer the old member's identity to the new device
    await db.mergeTeamMember(team.id, oldDeviceId, rejoinRequest.newDeviceId, rejoinRequest.playerName);
    // Add the new device as a team member if needed
    teamSync.respondToRejoinRequest(game.id, rejoinRequest.requestId, true, oldDeviceId);
    setRejoinRequest(null);
    setRejoinShowMerge(false);
    loadTeam(); // Refresh team data
  };

  const handleAddAsNewMember = async () => {
    if (!rejoinRequest || !team || !game) return;
    await db.addTeamMember(team.id, {
      deviceId: rejoinRequest.newDeviceId,
      name: rejoinRequest.playerName
    });
    teamSync.respondToRejoinRequest(game.id, rejoinRequest.requestId, true);
    setRejoinRequest(null);
    setRejoinShowMerge(false);
    loadTeam();
  };

  const handleRejectConfirm = (shouldRetire: boolean) => {
    if (!rejoinRequest || !game) return;
    if (shouldRetire) {
      // Captain can't retire a player that hasn't joined yet, so this is a no-op
      // But it signals intent
    }
    teamSync.respondToRejoinRequest(game.id, rejoinRequest.requestId, false);
    setRejoinRequest(null);
    setRejoinShowRetire(false);
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
        isRetired: live?.isRetired,
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
      {/* Top Bar: Brand + Color */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b-2 border-orange-500/40">
        <span className="text-xs font-black text-orange-400 uppercase tracking-[0.3em]">
          TEAMTRACK BY TEAMBATTLE
        </span>
        <div className="h-2 w-28 rounded-full" style={{ backgroundColor: teamColor }} />
      </div>

      {/* Header */}
      <div className="bg-black/40 border-b-2 border-orange-500/20 px-4 py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Team Avatar */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 shrink-0"
              style={{ backgroundColor: teamColor + '20', borderColor: teamColor + '60' }}
            >
              {team?.photoUrl ? (
                <img src={team.photoUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <Users className="w-7 h-7" style={{ color: teamColor }} />
              )}
            </div>
            <div className="min-w-0">
              {editingTeamName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTeamNameValue}
                    onChange={(e) => { setEditTeamNameValue(e.target.value); setEditTeamNameError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTeamName(); if (e.key === 'Escape') setEditingTeamName(false); }}
                    className="bg-slate-800 border border-orange-500/50 rounded-lg px-3 py-1 text-lg font-black text-white uppercase tracking-wider outline-none focus:border-orange-500 w-40"
                    autoFocus
                  />
                  <button onClick={handleSaveTeamName} className="p-1.5 bg-green-600 rounded-lg hover:bg-green-700"><Check className="w-4 h-4 text-white" /></button>
                  <button onClick={() => setEditingTeamName(false)} className="p-1.5 bg-slate-700 rounded-lg hover:bg-slate-600"><X className="w-4 h-4 text-white" /></button>
                  {editTeamNameError && <span className="text-xs text-red-400 font-bold">{editTeamNameError}</span>}
                </div>
              ) : (
                <h1
                  className={`text-xl font-black text-white uppercase tracking-wider truncate ${isCaptain ? 'cursor-pointer hover:text-orange-300 transition-colors' : ''}`}
                  onClick={isCaptain ? handleStartEditTeamName : undefined}
                  title={isCaptain ? 'Click to edit team name' : undefined}
                >
                  {team?.name || 'LOADING...'}
                  {isCaptain && <Pencil className="w-3.5 h-3.5 inline ml-2 text-slate-500" />}
                </h1>
              )}
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-white font-black uppercase tracking-wider">
                  <Trophy className="w-4 h-4 inline mr-1 text-orange-400" />
                  {team?.score || 0} PTS
                </span>
                {teamRank && (
                  <span className="text-sm text-orange-300 font-black uppercase tracking-wider">
                    #{teamRank}/{totalTeams}
                  </span>
                )}
                <span className="text-sm text-white font-bold uppercase">
                  {onlineCount}/{mergedMembers.length} ONLINE
                </span>
                {shortCode && (
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border-2 transition-colors"
                    style={{ color: '#fff', backgroundColor: teamColor + '25', borderColor: teamColor + '60' }}
                  >
                    {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {shortCode}
                  </button>
                )}
              </div>
            </div>
          </div>

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

          {/* Lobby Welcome Message (shown when onStartGame mode is active) */}
          {onStartGame && game?.lobbyMessageConfig?.enabled && game.lobbyMessageConfig.text && (
            <div
              className="mb-4 rounded-2xl p-5 border-2 border-blue-500/30"
              style={{ backgroundColor: game.lobbyMessageConfig.backgroundColor || '#1e293b' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Welcome</span>
              </div>
              {game.lobbyMessageConfig.useImage && game.lobbyMessageConfig.imageUrl ? (
                <img
                  src={game.lobbyMessageConfig.imageUrl}
                  alt="Welcome"
                  className="max-w-full max-h-[200px] object-contain rounded-lg mx-auto"
                  loading="lazy"
                />
              ) : (
                <div
                  className={`font-bold leading-relaxed ${
                    game.lobbyMessageConfig.fontSize === 'small' ? 'text-sm' :
                    game.lobbyMessageConfig.fontSize === 'large' ? 'text-xl' :
                    game.lobbyMessageConfig.fontSize === 'xlarge' ? 'text-2xl' : 'text-base'
                  }`}
                  style={{ color: game.lobbyMessageConfig.textColor || '#ffffff' }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(game.lobbyMessageConfig.text) }}
                />
              )}
            </div>
          )}

          {/* Timer display when no timer is configured (show 00:00) */}
          {onStartGame && (!countdown || countdown.state === 'no_timer') && (
            <div className="mb-4 rounded-2xl p-5 text-center border-2 bg-slate-900/50 border-slate-600/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-black uppercase tracking-widest text-slate-400">GAME TIME</span>
              </div>
              <p className="text-4xl font-black tracking-wider text-white">00:00</p>
            </div>
          )}

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
                <div className="bg-black/30 border-2 border-orange-500/20 rounded-2xl p-5">
                  <h2 className="text-sm font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-400" />
                    MEMBERS ({mergedMembers.length})
                    <span className="text-xs text-orange-300 ml-auto font-black">
                      {onlineCount} ONLINE
                    </span>
                  </h2>

                  <div className="space-y-2">
                    {mergedMembers.map(member => {
                      const isMemberCaptain = member.deviceId === team?.captainDeviceId;
                      const isMe = member.deviceId === myDeviceId;
                      const isExpanded = showMemberActions === member.deviceId;
                      const canManage = isCaptain && !isMe;

                      return (
                        <div key={member.deviceId}>
                          <button
                            onClick={() => {
                              if (canManage) {
                                setShowMemberActions(isExpanded ? null : member.deviceId);
                              }
                            }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left border-2 ${
                              isExpanded ? 'bg-orange-500/10 border-orange-500/40' :
                              member.isRetired ? 'bg-slate-900/30 border-slate-700/20 opacity-60' :
                              isMe ? 'bg-orange-500/5 border-orange-500/20' :
                              canManage ? 'border-white/10 hover:bg-orange-500/10 hover:border-orange-500/30' :
                              'border-transparent'
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
                                {editingPlayerName === member.deviceId ? (
                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editPlayerNameValue}
                                      onChange={(e) => { setEditPlayerNameValue(e.target.value); setEditPlayerNameError(null); }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlayerName(); if (e.key === 'Escape') setEditingPlayerName(null); }}
                                      className="bg-slate-800 border border-orange-500/50 rounded px-2 py-0.5 text-sm font-black text-white uppercase tracking-wider outline-none focus:border-orange-500 w-24"
                                      autoFocus
                                    />
                                    <button onClick={(e) => { e.stopPropagation(); handleSavePlayerName(); }} className="p-1 bg-green-600 rounded hover:bg-green-700"><Check className="w-3 h-3 text-white" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingPlayerName(null); }} className="p-1 bg-slate-700 rounded hover:bg-slate-600"><X className="w-3 h-3 text-white" /></button>
                                    {editPlayerNameError && <span className="text-[10px] text-red-400 font-bold">{editPlayerNameError}</span>}
                                  </div>
                                ) : (
                                <span
                                  className={`text-sm font-black text-white uppercase tracking-wider truncate ${(isCaptain || isMe) ? 'cursor-pointer hover:text-orange-300 transition-colors' : ''}`}
                                  onClick={(isCaptain || isMe) ? (e) => { e.stopPropagation(); handleStartEditPlayerName(member.deviceId, member.name); } : undefined}
                                  title={(isCaptain || isMe) ? 'Click to edit name' : undefined}
                                >
                                  {member.name || 'UNKNOWN'}
                                  {(isCaptain || isMe) && <Pencil className="w-2.5 h-2.5 inline ml-1.5 text-slate-600" />}
                                </span>
                                )}
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
                                {member.isRetired && (
                                  <span className="text-xs font-black text-red-400 uppercase">RETIRED</span>
                                )}
                                {member.deviceType && member.isOnline && (
                                  <span className="text-slate-300"><DeviceIcon type={member.deviceType} /></span>
                                )}
                              </div>
                            </div>

                            {/* Expand indicator for captain */}
                            {canManage && (
                              <div className="shrink-0">
                                {isExpanded
                                  ? <ChevronUp className="w-5 h-5 text-orange-400" />
                                  : <ChevronDown className="w-5 h-5 text-slate-300" />
                                }
                              </div>
                            )}
                          </button>

                          {/* Captain Actions (expanded) — LARGE buttons for tablet */}
                          {isExpanded && isCaptain && !isMe && (
                            <div className="flex flex-wrap gap-2 mt-2 px-2">
                              {member.isRetired ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnretirePlayer(member.deviceId); }}
                                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-orange-600/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-600/30 active:bg-orange-600/40 transition-colors"
                                >
                                  <UserCheck className="w-5 h-5" /> ACTIVATE
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRetirePlayer(member.deviceId); }}
                                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-orange-600/20 text-orange-400 border-2 border-orange-500/40 hover:bg-orange-600/30 active:bg-orange-600/40 transition-colors"
                                >
                                  <UserX className="w-5 h-5" /> DISABLE
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePromoteCaptain(member.deviceId, member.name); }}
                                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-white/10 text-white border-2 border-white/30 hover:bg-white/15 active:bg-white/20 transition-colors"
                              >
                                <Crown className="w-5 h-5" /> PROMOTE
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.deviceId, member.name); }}
                                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider bg-red-600/20 text-red-400 border-2 border-red-500/40 hover:bg-red-600/30 active:bg-red-600/40 transition-colors"
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

                  {isCaptain && mergedMembers.length > 0 && (
                    <div className="mt-4 pt-3 border-t-2 border-orange-500/20">
                      <div className="flex items-center gap-2 text-xs text-orange-300 font-black uppercase tracking-wider">
                        <Shield className="w-4 h-4 text-orange-400" />
                        TAP A MEMBER FOR CAPTAIN ACTIONS
                      </div>
                    </div>
                  )}

                  {/* Recover Player button (captain only) */}
                  {isCaptain && (
                    <button
                      onClick={handleShowRecoveryCodes}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-green-900/40 hover:bg-green-800/50 border border-green-500/30 rounded-xl text-green-400 font-black text-xs uppercase tracking-widest transition-all"
                    >
                      <Key className="w-4 h-4" />
                      RECOVER PLAYER CODES
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== VOTES TAB ==================== */}
          {activeTab === 'VOTES' && (
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
                votingTasks.map(point => {
                  const votes = taskVotes[point.id] || [];
                  const isExpanded = expandedTask === point.id;
                  const activeCount = activeMembers.length || 1;
                  const voteProgress = Math.min(votes.length / activeCount, 1);

                  // Check consensus
                  let hasConsensus = false;
                  let consensusAnswer: string | null = null;
                  if (votes.length >= activeCount && votes.length > 0) {
                    const firstNorm = normalizeAnswer(votes[0].answer);
                    hasConsensus = votes.every(v => normalizeAnswer(v.answer) === firstNorm);
                    if (hasConsensus) {
                      consensusAnswer = typeof votes[0].answer === 'string'
                        ? votes[0].answer
                        : JSON.stringify(votes[0].answer);
                    }
                  }

                  // Who voted, who hasn't
                  const votedDeviceIds = new Set(votes.map(v => v.deviceId));
                  const notVoted = activeMembers.filter(m => !votedDeviceIds.has(m.deviceId));

                  return (
                    <div key={point.id} className="bg-black/30 border-2 border-orange-500/20 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedTask(isExpanded ? null : point.id)}
                        className="w-full p-4 flex items-center gap-3 text-left hover:bg-orange-500/5 transition-colors"
                      >
                        {/* Status Icon */}
                        {hasConsensus ? (
                          <CheckCircle className="w-7 h-7 text-orange-400 shrink-0" />
                        ) : votes.length > 0 ? (
                          <AlertCircle className="w-7 h-7 text-orange-300 shrink-0 animate-pulse" />
                        ) : (
                          <Circle className="w-7 h-7 text-slate-400 shrink-0" />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-white uppercase tracking-wider truncate">
                            {point.title || `TASK ${point.id.slice(-4)}`}
                          </p>
                          <p className="text-xs text-orange-300 font-bold uppercase tracking-wider mt-1">
                            {hasConsensus ? 'CONSENSUS REACHED' :
                             votes.length > 0 ? `${votes.length}/${activeCount} VOTED` :
                             'NO VOTES YET'}
                          </p>
                        </div>

                        {/* Progress bar */}
                        <div className="w-20 shrink-0">
                          <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-orange-500/20">
                            <div
                              className={`h-full rounded-full transition-all ${
                                hasConsensus ? 'bg-orange-400' : 'bg-orange-600/60'
                              }`}
                              style={{ width: `${voteProgress * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-white font-black text-center mt-1">
                            {votes.length}/{activeCount}
                          </p>
                        </div>

                        {isExpanded ? <ChevronUp className="w-5 h-5 text-orange-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-white shrink-0" />}
                      </button>

                      {/* Expanded: Show individual votes */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t-2 border-orange-500/20 pt-3">
                          {/* Consensus answer */}
                          {hasConsensus && consensusAnswer && (
                            <div className="mb-3 p-4 bg-orange-900/20 border-2 border-orange-500/40 rounded-xl">
                              <p className="text-xs text-orange-400 font-black uppercase tracking-widest mb-1">CONSENSUS ANSWER</p>
                              <p className="text-base text-white font-black">{consensusAnswer}</p>
                            </div>
                          )}

                          {/* Individual votes */}
                          <div className="space-y-2">
                            <p className="text-xs text-orange-400 font-black uppercase tracking-widest">VOTES</p>
                            {votes.map(vote => (
                              <div key={vote.deviceId} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-orange-500/10">
                                <CheckCircle className="w-4 h-4 text-orange-400 shrink-0" />
                                <span className="text-sm font-black text-white uppercase tracking-wider flex-1 truncate">
                                  {vote.userName}
                                </span>
                                <span className="text-sm text-slate-300 font-bold truncate max-w-[140px]">
                                  {typeof vote.answer === 'string' ? vote.answer : JSON.stringify(vote.answer)}
                                </span>
                              </div>
                            ))}

                            {/* Not yet voted */}
                            {notVoted.length > 0 && (
                              <>
                                <p className="text-xs text-orange-300 font-black uppercase tracking-widest mt-3">WAITING FOR</p>
                                {notVoted.map(m => (
                                  <div key={m.deviceId} className="flex items-center gap-2 p-3 bg-slate-900/30 rounded-xl opacity-60 border border-slate-600/20">
                                    <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span className="text-sm font-bold text-white uppercase tracking-wider">
                                      {m.name || 'UNKNOWN'}
                                    </span>
                                    <span className="text-xs text-slate-300 ml-auto font-bold uppercase">
                                      {m.isOnline ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}

                            {/* Captain: Submit Team Answer */}
                            {isCaptain && votes.length > 0 && onTaskDecided && (
                              <div className="mt-4 pt-4 border-t-2 border-orange-500/20">
                                <button
                                  onClick={() => {
                                    // Determine the majority answer (most common)
                                    const answerCounts: Record<string, { count: number; answer: any }> = {};
                                    votes.forEach(v => {
                                      const key = normalizeAnswer(v.answer);
                                      if (!answerCounts[key]) answerCounts[key] = { count: 0, answer: v.answer };
                                      answerCounts[key].count++;
                                    });
                                    const sorted = Object.values(answerCounts).sort((a, b) => b.count - a.count);
                                    const agreedAnswer = sorted[0]?.answer;

                                    // Check correctness
                                    let isCorrect = false;
                                    const task = point.task;
                                    const correctAnswer = task.answer || (task.correctAnswers && task.correctAnswers[0]);
                                    if (correctAnswer !== undefined && agreedAnswer !== undefined) {
                                      const agreedStr = typeof agreedAnswer === 'string' ? agreedAnswer : JSON.stringify(agreedAnswer);
                                      const correctStr = typeof correctAnswer === 'string' ? correctAnswer : JSON.stringify(correctAnswer);
                                      isCorrect = normalizeAnswer(agreedStr) === normalizeAnswer(correctStr);
                                    }

                                    // Broadcast decision to players
                                    teamSync.broadcastTaskDecided({
                                      pointId: point.id,
                                      isCorrect,
                                      correctAnswer: task.answer || (task.correctAnswers ? task.correctAnswers[0] : undefined),
                                      agreedAnswer,
                                      pointsAwarded: isCorrect ? (point.points || 0) : 0,
                                      timestamp: Date.now()
                                    });

                                    onTaskDecided(point.id);
                                  }}
                                  className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-lg shadow-green-900/30 transition-all"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                  SUBMIT TEAM ANSWER
                                </button>
                                <p className="text-[9px] text-slate-500 text-center mt-2 font-bold uppercase">
                                  SUBMITS THE MAJORITY ANSWER AND NOTIFIES ALL PLAYERS
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ==================== CHAT TAB ==================== */}
          {activeTab === 'CHAT' && (
            <div className="flex flex-col" style={{ height: 'calc(100vh - 240px)' }}>
              {/* Recipient Selector */}
              <div className="mb-3 relative">
                <button
                  onClick={() => setShowRecipientSelector(!showRecipientSelector)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-black uppercase tracking-widest transition-all ${
                    chatRecipient === 'gamemaster'
                      ? 'bg-green-900/30 border-green-500/50 text-green-400'
                      : chatRecipient === 'all'
                      ? 'bg-red-900/20 border-red-500/40 text-red-400'
                      : 'bg-blue-900/20 border-blue-500/40 text-blue-400'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {chatRecipient === 'gamemaster' && <Radio className="w-4 h-4" />}
                    {chatRecipient === 'all' && <Megaphone className="w-4 h-4" />}
                    {chatRecipient !== 'gamemaster' && chatRecipient !== 'all' && <Users className="w-4 h-4" />}
                    TO: {getRecipientLabel()}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRecipientSelector ? 'rotate-180' : ''}`} />
                </button>

                {showRecipientSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 animate-in slide-in-from-top-1">
                    {/* GAMEMASTER — always at top */}
                    <button
                      onClick={() => { setChatRecipient('gamemaster'); setShowRecipientSelector(false); }}
                      className={`w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-green-900/30 text-sm font-black uppercase tracking-wider flex items-center gap-3 transition-all ${
                        chatRecipient === 'gamemaster' ? 'bg-green-900/20 text-green-400' : 'text-white'
                      }`}
                    >
                      <Radio className="w-4 h-4 text-green-400" />
                      GAMEMASTER
                      {chatRecipient === 'gamemaster' && <Check className="w-4 h-4 ml-auto text-green-400" />}
                    </button>

                    {/* Individual teams */}
                    {gameTeams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setChatRecipient(t.id); setShowRecipientSelector(false); }}
                        className={`w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-blue-900/20 text-sm font-bold flex items-center justify-between transition-all ${
                          chatRecipient === t.id ? 'text-blue-400 bg-blue-900/10' : 'text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#94a3b8' }} />
                          {t.name}
                        </span>
                        {chatRecipient === t.id && <Check className="w-4 h-4 text-blue-400" />}
                      </button>
                    ))}

                    {/* SEND TO ALL — always at bottom */}
                    <button
                      onClick={() => { setChatRecipient('all'); setShowRecipientSelector(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-red-900/20 text-sm font-black uppercase tracking-wider flex items-center gap-3 transition-all ${
                        chatRecipient === 'all' ? 'bg-red-900/20 text-red-400' : 'text-orange-400'
                      }`}
                    >
                      <Megaphone className="w-4 h-4 text-red-400" />
                      SEND TO ALL TEAMS
                      {chatRecipient === 'all' && <Check className="w-4 h-4 ml-auto text-red-400" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-16">
                    <MessageSquare className="w-14 h-14 text-orange-500/30 mx-auto mb-3" />
                    <p className="text-base font-black text-white uppercase tracking-wider">NO MESSAGES YET</p>
                    <p className="text-sm text-slate-300 font-bold uppercase mt-2">
                      SELECT A RECIPIENT AND SEND A MESSAGE
                    </p>
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isFromMe = msg.senderTeamName?.toLowerCase() === team?.name?.toLowerCase() || msg.sender.includes(teamSync.getUserName());
                    const isFromInstructor = msg.sender === 'Instructor' || msg.sender === 'Gamemaster';
                    const isConfirmed = confirmedMessageIds.has(msg.id);

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 border-2 ${
                          isFromInstructor
                            ? 'bg-gradient-to-br from-green-900/40 to-orange-900/30 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                            : isFromMe
                            ? 'bg-blue-900/30 border-blue-500/30'
                            : 'bg-slate-800/50 border-slate-600/30'
                        }`}>
                          <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                            isFromInstructor ? 'text-green-400' :
                            isFromMe ? 'text-blue-400' : 'text-slate-300'
                          }`}>
                            {isFromInstructor && <Shield className="w-3.5 h-3.5 inline mr-1 text-orange-400" />}
                            {msg.sender}
                          </p>
                          <p className={`text-sm font-bold ${
                            msg.isUrgent ? 'text-orange-300' : 'text-white'
                          }`}>
                            {msg.message}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-slate-400 font-bold">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {msg.confirmRequired && !isFromMe && (
                              isConfirmed ? (
                                <span className="text-[10px] font-black text-green-400 uppercase flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> CONFIRMED
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleConfirmRead(msg.id)}
                                  className="text-[10px] font-black text-orange-400 uppercase bg-orange-500/20 border border-orange-500/40 rounded-lg px-2 py-0.5 hover:bg-orange-500/30 transition-all"
                                >
                                  CONFIRM READ
                                </button>
                              )
                            )}
                          </div>
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
                    placeholder={chatRecipient === 'gamemaster' ? 'MESSAGE GAMEMASTER...' : chatRecipient === 'all' ? 'MESSAGE ALL TEAMS...' : 'TYPE A MESSAGE...'}
                    className="flex-1 bg-black/30 border-2 border-orange-500/20 rounded-xl px-4 py-4 text-sm text-white font-bold uppercase tracking-wider placeholder:text-slate-400 outline-none focus:border-orange-500/60 transition-colors"
                  />
                  <button
                    onClick={() => handleSendChat()}
                    disabled={!chatInput.trim()}
                    className={`px-6 py-4 text-white rounded-xl font-black uppercase tracking-wider transition-colors flex items-center gap-2 border-2 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 ${
                      chatRecipient === 'gamemaster'
                        ? 'bg-green-600 hover:bg-green-700 border-green-500'
                        : chatRecipient === 'all'
                        ? 'bg-red-600 hover:bg-red-700 border-red-500'
                        : 'bg-blue-600 hover:bg-blue-700 border-blue-500'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                    SEND
                  </button>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-2 text-center">
                  {chatRecipient === 'gamemaster' ? 'SENDS TO GAMEMASTER & INSTRUCTOR' :
                   chatRecipient === 'all' ? 'SENDS TO ALL TEAMS IN THE GAME' :
                   `SENDS TO ${getRecipientLabel()}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: START GAME (captain only) or countdown/waiting (player) */}
      {onStartGame && (
        <div className="border-t-2 border-orange-500/30 bg-[#0a0f1d]/95 backdrop-blur-sm p-4">
          {isCaptain ? (
            // Captain sees the START GAME button — disabled until master game start time is due
            (!countdown || countdown.state === 'no_timer' || countdown.state === 'game_started') ? (
              <button
                onClick={onStartGame}
                className="w-full max-w-md mx-auto block py-5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-2xl font-black text-xl uppercase tracking-[0.2em] shadow-2xl shadow-orange-600/40 transition-all flex items-center justify-center gap-3 group animate-pulse hover:animate-none"
              >
                <Play className="w-7 h-7 group-hover:scale-110 transition-transform" />
                START GAME
              </button>
            ) : (
              <div className="text-center">
                {(() => {
                  const secondsLeft = Math.ceil(countdown.remainingMs / 1000);
                  const isBeeping = secondsLeft <= 10 && secondsLeft > 0;
                  const isFinal = secondsLeft <= 3 && secondsLeft > 0;
                  return (
                    <>
                      <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isBeeping ? 'text-red-400' : 'text-slate-400'}`}>
                        {isBeeping ? 'GET READY!' : countdown.label}
                      </p>
                      <p className={`font-black tracking-wider mb-3 transition-all ${
                        isFinal ? 'text-5xl text-red-500 animate-pulse' :
                        isBeeping ? 'text-4xl text-orange-400 animate-pulse' :
                        'text-3xl text-orange-400'
                      }`}>
                        {countdown.remainingMs > 0 ? (isBeeping ? secondsLeft : formatCountdown(countdown.remainingMs)) : '00:00'}
                      </p>
                      <button
                        disabled
                        className={`w-full max-w-md mx-auto block py-4 rounded-2xl font-black text-lg uppercase tracking-[0.15em] cursor-not-allowed flex items-center justify-center gap-3 border-2 ${
                          isBeeping
                            ? 'bg-orange-900/30 border-orange-500/50 text-orange-400 opacity-80'
                            : 'bg-slate-800 border-slate-700 text-slate-500 opacity-60'
                        }`}
                      >
                        <Play className="w-6 h-6" />
                        {isBeeping ? 'AUTO-STARTING...' : 'WAITING FOR START TIME'}
                      </button>
                    </>
                  );
                })()}
              </div>
            )
          ) : (
            // Player sees "waiting for captain" message or countdown
            <div className="text-center">
              {countdown && countdown.state !== 'no_timer' && countdown.remainingMs > 0 ? (
                (() => {
                  const sLeft = Math.ceil(countdown.remainingMs / 1000);
                  const beeping = sLeft <= 10;
                  const final3 = sLeft <= 3;
                  return (
                    <>
                      <p className={`text-xs font-black uppercase tracking-widest mb-2 ${beeping ? 'text-red-400' : 'text-slate-400'}`}>
                        {beeping ? 'GET READY!' : countdown.label}
                      </p>
                      <p className={`font-black tracking-wider ${
                        final3 ? 'text-5xl text-red-500 animate-pulse' :
                        beeping ? 'text-4xl text-orange-400 animate-pulse' :
                        'text-3xl text-orange-400'
                      }`}>
                        {beeping ? sLeft : formatCountdown(countdown.remainingMs)}
                      </p>
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      WAITING FOR CAPTAIN TO START
                    </p>
                  </div>
                  <div className="flex gap-1 justify-center mt-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== REJOIN REQUEST MODAL (captain) ==================== */}
      {rejoinRequest && !rejoinShowMerge && !rejoinShowRetire && (
        <div className="fixed inset-0 z-[6000] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-green-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-green-500/20">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-full mx-auto flex items-center justify-center mb-4 border-2 border-green-500/40">
                <UserPlus className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest mb-2">REJOIN REQUEST</h2>
              <p className="text-sm text-slate-300">
                <span className="text-green-400 font-black">{rejoinRequest.playerName}</span> wants to rejoin your team
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleAcceptRejoin}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
              >
                <UserCheck className="w-5 h-5" />
                ACCEPT
              </button>
              <button
                onClick={handleRejectRejoin}
                className="w-full py-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border-2 border-red-500/40 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
              >
                <UserX className="w-5 h-5" />
                REJECT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MERGE MEMBER MODAL (captain accepted rejoin) ==================== */}
      {rejoinRequest && rejoinShowMerge && (
        <div className="fixed inset-0 z-[6000] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-orange-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-5">
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-2">MERGE PLAYER?</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Should <span className="text-green-400 font-black">{rejoinRequest.playerName}</span> take over an existing member's identity? This transfers their game progress to the new device.
              </p>
            </div>

            {/* Member list for merge */}
            <div className="space-y-2 mb-4">
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">SELECT MEMBER TO MERGE WITH</p>
              {mergedMembers.map(member => (
                <button
                  key={member.deviceId}
                  onClick={() => handleMergeWith(member.deviceId)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-orange-500/50 transition-all text-left"
                >
                  {member.photo ? (
                    <img src={member.photo} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white uppercase tracking-wider truncate">{member.name}</p>
                    <p className="text-xs text-slate-400">
                      {member.deviceId === team?.captainDeviceId ? 'Captain' : 'Member'}
                      {member.isRetired ? ' • Retired' : ''}
                      {!member.isOnline ? ' • Offline' : ''}
                    </p>
                  </div>
                  <RefreshCw className="w-4 h-4 text-orange-400 shrink-0" />
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-slate-700 flex-1" />
              <span className="text-[10px] font-black text-slate-500 uppercase">OR</span>
              <div className="h-px bg-slate-700 flex-1" />
            </div>

            {/* Add as new */}
            <button
              onClick={handleAddAsNewMember}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 mb-3"
            >
              <UserPlus className="w-5 h-5" />
              ADD AS NEW MEMBER
            </button>

            {/* Cancel */}
            <button
              onClick={() => { setRejoinShowMerge(false); setRejoinRequest(null); }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ==================== RETIRE PROMPT (captain rejected rejoin) ==================== */}
      {rejoinRequest && rejoinShowRetire && (
        <div className="fixed inset-0 z-[6000] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto flex items-center justify-center mb-4 border-2 border-red-500/40">
                <UserX className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-2">REJECT PLAYER</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-red-400 font-black">{rejoinRequest.playerName}</span> will be rejected. Should they be retired from the team roster?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleRejectConfirm(true)}
                className="w-full py-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border-2 border-red-500/40 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all"
              >
                YES, RETIRE PLAYER
              </button>
              <button
                onClick={() => handleRejectConfirm(false)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all"
              >
                NO, JUST REJECT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RECOVERY CODES MODAL (captain) ==================== */}
      {showRecoveryCodes && (
        <div className="fixed inset-0 z-[6000] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-green-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto flex items-center justify-center mb-4 border-2 border-green-500/40">
                <Key className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-2">RECOVERY CODES</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Share these codes with players who need to recover their game on a new device.
              </p>
            </div>

            {recoveryCodesLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 text-green-500 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-400 uppercase tracking-wider">Loading codes...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mergedMembers.map(member => {
                  const code = recoveryCodes[member.deviceId];
                  return (
                    <div key={member.deviceId} className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {member.photo ? (
                          <img src={member.photo} className="w-8 h-8 rounded-full object-cover border border-slate-600" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                            <Users className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <span className="text-sm font-black text-white uppercase truncate">{member.name}</span>
                      </div>
                      {code ? (
                        <button
                          onClick={() => handleCopyRecoveryCode(code)}
                          className="flex items-center gap-2 bg-green-900/40 hover:bg-green-800/50 border border-green-500/30 rounded-lg px-3 py-1.5 transition-all"
                        >
                          <span className="text-sm font-mono font-bold text-green-400 tracking-widest">{code}</span>
                          {copiedRecoveryCode === code ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-green-500/60" />
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No code</span>
                      )}
                    </div>
                  );
                })}
                {mergedMembers.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-4">No team members yet</p>
                )}
              </div>
            )}

            <button
              onClick={() => setShowRecoveryCodes(false)}
              className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ==================== SEND TO ALL WARNING MODAL ==================== */}
      {showSendAllWarning && (
        <div className="fixed inset-0 z-[6000] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-red-500/20">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto flex items-center justify-center mb-4 border-2 border-red-500/40">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest mb-2">SEND TO ALL?</h2>
              <p className="text-sm text-red-300 font-bold uppercase tracking-wider">
                SURE THAT ALL TEAMS NEED THAT MESSAGE?
              </p>
              <div className="mt-3 bg-red-900/20 border border-red-500/30 rounded-xl p-3">
                <p className="text-sm text-white font-bold italic">"{chatInput}"</p>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleSendChat(true)}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
              >
                <Megaphone className="w-5 h-5" />
                YES, SEND TO ALL
              </button>
              <button
                onClick={() => setShowSendAllWarning(false)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CONFIRM READ POPUP (from gamemaster) ==================== */}
      {confirmReadMessages.length > 0 && (
        <div className="fixed inset-0 z-[7000] bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-orange-500/60 rounded-3xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(249,115,22,0.3)] animate-pulse-slow">
            <div className="text-center mb-5">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500/30 to-orange-500/30 rounded-full mx-auto flex items-center justify-center mb-4 border-2 border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                <Megaphone className="w-10 h-10 text-orange-400" />
              </div>
              <h2 className="text-xl font-black text-orange-400 uppercase tracking-[0.2em] mb-1">IMPORTANT MESSAGE</h2>
              <p className="text-xs text-green-400 font-black uppercase tracking-widest">
                FROM {confirmReadMessages[0].sender}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-900/30 to-orange-900/20 border-2 border-orange-500/40 rounded-2xl p-5 mb-6 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              <p className="text-base text-white font-bold leading-relaxed text-center">
                {confirmReadMessages[0].message}
              </p>
              <p className="text-xs text-slate-400 font-bold mt-3 text-center">
                {new Date(confirmReadMessages[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <button
              onClick={() => handleConfirmRead(confirmReadMessages[0].id)}
              className="w-full py-5 bg-gradient-to-r from-green-600 to-orange-600 hover:from-green-700 hover:to-orange-700 text-white rounded-2xl font-black text-lg uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-600/30"
            >
              <CheckCircle className="w-6 h-6" />
              CONFIRM READ
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay with progress bar and fun texts */}
      {loading && !team && (
        <div className="absolute inset-0 bg-[#0a0f1d] flex items-center justify-center">
          <div className="text-center w-full max-w-xs px-6">
            <RefreshCw className="w-14 h-14 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-lg text-white font-black uppercase tracking-wider mb-6">PREPARING TEAM LOBBY</p>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                style={{ animation: 'loadProgress 30s ease-out forwards' }}
              />
            </div>
            <style>{`
              @keyframes loadProgress {
                0% { width: 3%; }
                10% { width: 15%; }
                25% { width: 35%; }
                40% { width: 50%; }
                60% { width: 70%; }
                80% { width: 85%; }
                90% { width: 92%; }
                100% { width: 98%; }
              }
            `}</style>
            <p className="text-xs text-slate-400 mt-4 uppercase tracking-widest transition-opacity duration-500 h-5">
              {funLoadingTexts[loadingTextIndex]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamLobbyView;
