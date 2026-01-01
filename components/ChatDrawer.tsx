import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GameMode, Team } from '../types';
import { X, Send, MessageSquare, User, Shield, Radio, Siren, CheckCircle2, ChevronDown, Globe, Check } from 'lucide-react';
import { teamSync } from '../services/teamSync';
import { vibrateChatNotification } from '../utils/vibration';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  gameId: string;
  mode: GameMode;
  userName: string;
  teamId?: string;
  teams?: Team[]; // List of teams for instructor to select from
  selectedTeamIds?: string[] | null; // Changed from selectedTeamId
  isInstructor?: boolean; // Force instructor mode (e.g. from Hub)
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({ 
  isOpen, 
  onClose, 
  messages, 
  gameId, 
  mode,
  userName,
  teamId,
  teams = [],
  selectedTeamIds,
  isInstructor = false
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [targetTeamIds, setTargetTeamIds] = useState<string[] | null>(null); // Null = Global Broadcast
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine if we are in instructor mode (either by GameMode or explicit prop)
  const isInstructorMode = mode === GameMode.INSTRUCTOR || isInstructor;

  // Sync prop to state when drawer opens or prop changes
  useEffect(() => {
      setTargetTeamIds(selectedTeamIds || null);
  }, [selectedTeamIds, isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Vibrate on new messages (for team players, not for instructors who sent the message)
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    // Only vibrate if:
    // 1. Drawer is open
    // 2. We're not in instructor mode (players should feel vibration)
    // 3. A new message arrived (count increased)
    if (isOpen && !isInstructorMode && messages.length > prevMessageCountRef.current) {
      const latestMessage = messages[messages.length - 1];

      // Vibrate with different intensity for urgent messages
      vibrateChatNotification(latestMessage?.isUrgent || false);
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, isOpen, isInstructorMode]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    setIsSending(true);

    const urgentFlag = isInstructorMode ? isUrgent : false;
    
    // Send to specific team channels if selected, otherwise global
    if (targetTeamIds && targetTeamIds.length > 0) {
        // Multi-cast
        targetTeamIds.forEach(id => {
            teamSync.sendChatMessage(gameId, newMessage, id, urgentFlag);
        });
    } else {
        // Broadcast
        teamSync.sendChatMessage(gameId, newMessage, null, urgentFlag);
    }
    
    setNewMessage('');
    setIsUrgent(false);
    setIsSending(false);
  };

  const getTargetLabel = () => {
      if (!targetTeamIds || targetTeamIds.length === 0) return "BROADCAST (ALL TEAMS)";
      if (targetTeamIds.length === 1) {
          const t = teams.find(team => team.id === targetTeamIds[0]);
          return t ? `TO: ${t.name}` : "UNKNOWN TEAM";
      }
      return `TO: ${targetTeamIds.length} TEAMS`;
  };

  const toggleTarget = (id: string) => {
      setTargetTeamIds(prev => {
          const current = prev || [];
          if (current.includes(id)) {
              const next = current.filter(tid => tid !== id);
              return next.length === 0 ? null : next; // If empty, switch to global? Or keep empty? 
              // Let's say null is global. If user deselects all, maybe we explicitly set empty array? 
              // But standard UI usually defaults to Global if nothing selected. Let's assume null is global.
          } else {
              return [...current, id];
          }
      });
  };

  return (
    <div 
      className={`fixed inset-y-0 right-0 z-[5000] w-full sm:w-96 bg-slate-900 border-l border-slate-700 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <MessageSquare className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Mission Comms</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
              {isInstructorMode ? 'Instructor Channel' : 'Team Feed'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Instructor Recipient Selector */}
      {isInstructorMode && (
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 relative z-20">
              <button 
                onClick={() => setShowTeamSelector(!showTeamSelector)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-all ${targetTeamIds && targetTeamIds.length > 0 ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
              >
                  <span className="flex items-center gap-2">
                      {targetTeamIds && targetTeamIds.length > 0 ? <User className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                      {getTargetLabel()}
                  </span>
                  <ChevronDown className="w-3 h-3" />
              </button>

              {showTeamSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 mx-4 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in slide-in-from-top-1">
                      <button 
                        onClick={() => { setTargetTeamIds(null); setShowTeamSelector(false); }}
                        className="w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-2 uppercase"
                      >
                          <Globe className="w-3 h-3 text-orange-500" /> BROADCAST TO ALL
                      </button>
                      {teams.map(t => {
                          const isSelected = targetTeamIds?.includes(t.id);
                          return (
                              <button
                                key={t.id}
                                onClick={() => toggleTarget(t.id)}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-700 text-xs font-medium border-b border-slate-700/50 last:border-0 flex justify-between items-center ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}
                              >
                                  <span>{t.name}</span>
                                  {isSelected && <Check className="w-3 h-3" />}
                              </button>
                          );
                      })}
                  </div>
              )}
          </div>
      )}

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 gap-2">
            <Radio className="w-12 h-12" />
            <p className="text-xs font-black uppercase tracking-widest">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            // Determine if message is from "me"
            // If instructor mode, "me" is 'Instructor'
            // If player mode, "me" is userName
            const isMe = msg.sender === (isInstructorMode ? 'Instructor' : userName);
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${msg.sender === 'Instructor' ? 'bg-orange-900/50 text-orange-400 border border-orange-500/20' : 'bg-slate-800 text-slate-400'}`}>
                    {msg.sender === 'Instructor' ? 'HQ' : msg.sender}
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm font-medium leading-relaxed relative ${
                  msg.isUrgent 
                    ? 'bg-red-900/20 border border-red-500/50 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                    : isMe 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.isUrgent && (
                    <div className="flex items-center gap-1 text-[9px] font-black text-red-400 uppercase tracking-widest mb-1 pb-1 border-b border-red-500/30">
                      <Siren className="w-3 h-3" /> URGENT
                    </div>
                  )}
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
        {isInstructorMode && (
          <div className="flex items-center gap-2 mb-3">
             <button 
                onClick={() => setIsUrgent(!isUrgent)}
                className={`flex-1 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isUrgent ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-red-500/50'}`}
             >
                <Siren className="w-3 h-3" /> {isUrgent ? 'URGENT ENABLED' : 'MARK URGENT'}
             </button>
          </div>
        )}
        
        <div className="relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={targetTeamIds && targetTeamIds.length > 0 ? "Message selected..." : "Broadcast to all..."}
            className={`w-full bg-slate-900 border-2 rounded-xl pl-4 pr-12 py-3 text-sm text-white font-bold outline-none transition-all placeholder:text-slate-600 ${isUrgent ? 'border-red-900/50 focus:border-red-500' : 'border-slate-800 focus:border-blue-600'}`}
          />
          <button 
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${newMessage.trim() ? 'bg-blue-600 text-white hover:bg-blue-500' : 'text-slate-600 hover:text-slate-400'}`}
          >
            {isSending ? <CheckCircle2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatDrawer;
