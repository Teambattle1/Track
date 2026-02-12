import React, { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle, XCircle, Send, Loader2, User, Trophy, Target, Zap, CircleDot, ChevronDown } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Game, TaskVote, TeamMember, OpenTaskPayload, TaskDecidedPayload, PlayerTaskStats } from '../types';
import { teamSync } from '../services/teamSync';

type PlayerScreen = 'LOBBY' | 'TASK' | 'WAITING' | 'RESULT';

interface PlayerPlayViewProps {
  game: Game;
  teamName: string;
  teamColor?: string;
}

const PlayerPlayView: React.FC<PlayerPlayViewProps> = ({ game, teamName, teamColor = '#f97316' }) => {
  // Screen state
  const [screen, setScreen] = useState<PlayerScreen>('LOBBY');

  // Task state
  const [currentTask, setCurrentTask] = useState<OpenTaskPayload | null>(null);
  const [answer, setAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState(50);
  const [hasVoted, setHasVoted] = useState(false);

  // Voting progress
  const [teamVotes, setTeamVotes] = useState<TaskVote[]>([]);
  const [liveMembers, setLiveMembers] = useState<TeamMember[]>([]);

  // Result state
  const [taskResult, setTaskResult] = useState<TaskDecidedPayload | null>(null);

  // Running stats
  const [stats, setStats] = useState<PlayerTaskStats>({
    correctCount: 0,
    incorrectCount: 0,
    totalAttempted: 0,
    pointsEarned: 0
  });

  // Animation
  const [showResultAnimation, setShowResultAnimation] = useState(false);

  // Lock portrait orientation for mobile players
  useEffect(() => {
    try {
      (window.screen as any).orientation?.lock?.('portrait-primary')?.catch?.(() => {});
    } catch {}
    return () => {
      try { (window.screen as any).orientation?.unlock?.(); } catch {}
    };
  }, []);

  // Subscribe to open_task
  useEffect(() => {
    const unsub = teamSync.subscribeToOpenTask((payload) => {
      setCurrentTask(payload);
      setAnswer('');
      setSelectedOptions([]);
      setSliderValue(payload.task.range?.min || 50);
      setHasVoted(false);
      setTaskResult(null);
      setShowResultAnimation(false);
      setTeamVotes([]);
      setScreen('TASK');
    });
    return unsub;
  }, []);

  // Subscribe to task_decided
  useEffect(() => {
    const unsub = teamSync.subscribeToTaskDecided((payload) => {
      setTaskResult(payload);
      setStats(prev => ({
        correctCount: prev.correctCount + (payload.isCorrect ? 1 : 0),
        incorrectCount: prev.incorrectCount + (payload.isCorrect ? 0 : 1),
        totalAttempted: prev.totalAttempted + 1,
        pointsEarned: prev.pointsEarned + payload.pointsAwarded,
      }));
      setShowResultAnimation(true);
      setScreen('RESULT');
    });
    return unsub;
  }, []);

  // Subscribe to votes for current task
  useEffect(() => {
    if (!currentTask) return;
    const unsub = teamSync.subscribeToVotesForTask(currentTask.pointId, (votes) => {
      setTeamVotes(votes);
    });
    return unsub;
  }, [currentTask?.pointId]);

  // Subscribe to members
  useEffect(() => {
    const unsub = teamSync.subscribeToMembers((members) => {
      setLiveMembers(members.filter(m => !m.isRetired));
    });
    return unsub;
  }, []);

  // Vote submission
  const handleSubmitVote = () => {
    if (!currentTask) return;
    let finalAnswer: any = answer;
    const type = currentTask.task.type;
    if (type === 'checkbox' || type === 'multi_select_dropdown') {
      finalAnswer = selectedOptions;
    } else if (type === 'slider') {
      finalAnswer = sliderValue;
    }
    teamSync.castVote(currentTask.pointId, finalAnswer);
    setHasVoted(true);
    setScreen('WAITING');
  };

  // Check if submit is valid
  const canSubmit = () => {
    if (!currentTask) return false;
    const type = currentTask.task.type;
    if (type === 'text') return answer.trim().length > 0;
    if (type === 'multiple_choice' || type === 'boolean' || type === 'dropdown') return answer !== '';
    if (type === 'checkbox' || type === 'multi_select_dropdown') return selectedOptions.length > 0;
    if (type === 'slider') return true;
    return false;
  };

  // Render answer input based on task type (ported from TaskModal patterns)
  const renderAnswerInput = () => {
    if (!currentTask) return null;
    const { type, options, range } = currentTask.task;

    switch (type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {options?.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => setAnswer(opt)}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between text-base font-bold ${
                  answer === opt
                    ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-200 active:bg-slate-700'
                }`}
              >
                <span>{opt}</span>
                {answer === opt && <div className="w-5 h-5 bg-orange-500 rounded-full shrink-0" />}
              </button>
            ))}
          </div>
        );

      case 'text':
        return (
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-5 py-4 rounded-2xl border-2 border-slate-700 bg-slate-800/50 text-white text-lg font-bold outline-none focus:border-orange-500 transition-colors placeholder:text-slate-500"
            autoFocus
          />
        );

      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAnswer('true')}
              className={`p-6 rounded-2xl border-2 font-black text-lg uppercase transition-all ${
                answer === 'true'
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 active:bg-slate-700'
              }`}
            >
              TRUE
            </button>
            <button
              onClick={() => setAnswer('false')}
              className={`p-6 rounded-2xl border-2 font-black text-lg uppercase transition-all ${
                answer === 'false'
                  ? 'border-red-500 bg-red-500/20 text-red-400'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 active:bg-slate-700'
              }`}
            >
              FALSE
            </button>
          </div>
        );

      case 'checkbox':
      case 'multi_select_dropdown':
        return (
          <div className="space-y-3">
            {options?.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (selectedOptions.includes(opt)) {
                    setSelectedOptions(selectedOptions.filter(o => o !== opt));
                  } else {
                    setSelectedOptions([...selectedOptions, opt]);
                  }
                }}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 text-base font-bold ${
                  selectedOptions.includes(opt)
                    ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-200 active:bg-slate-700'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                  selectedOptions.includes(opt) ? 'border-orange-500 bg-orange-500' : 'border-slate-600'
                }`}>
                  {selectedOptions.includes(opt) && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        );

      case 'dropdown':
        return (
          <div className="relative">
            <select
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-700 bg-slate-800 text-white text-lg font-bold outline-none focus:border-orange-500 appearance-none"
            >
              <option value="">Select an answer...</option>
              {options?.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>
        );

      case 'slider':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-400">{range?.min || 0}</span>
              <span className="text-4xl font-black text-orange-400">{sliderValue}</span>
              <span className="text-sm font-bold text-slate-400">{range?.max || 100}</span>
            </div>
            <input
              type="range"
              min={range?.min || 0}
              max={range?.max || 100}
              step={range?.step || 1}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseInt(e.target.value))}
              className="w-full h-4 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>
        );

      case 'info':
        return (
          <div className="text-center py-6">
            <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">INFORMATION ONLY</p>
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">CAPTAIN IS HANDLING THIS TASK</p>
          </div>
        );
    }
  };

  const activeCount = liveMembers.length || 1;
  const votedDeviceIds = new Set(teamVotes.map(v => v.deviceId));

  // ===========================
  // LOBBY SCREEN
  // ===========================
  if (screen === 'LOBBY') {
    return (
      <div className="fixed inset-0 z-[4000] bg-[#0a0f1d] text-white flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-4 border-b-2 border-orange-500/30 bg-black/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: teamColor + '30', borderColor: teamColor }}>
              <User className="w-5 h-5" style={{ color: teamColor }} />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest">{teamName}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PLAYER MODE</p>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-green-400">{stats.correctCount}</p>
              <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">CORRECT</p>
            </div>
            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-red-400">{stats.incorrectCount}</p>
              <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">INCORRECT</p>
            </div>
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-2xl p-4 text-center">
              <Trophy className="w-6 h-6 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-black text-orange-400">{stats.pointsEarned}</p>
              <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest">POINTS</p>
            </div>
          </div>

          {stats.totalAttempted > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">TASKS SOLVED</span>
                <span className="text-sm font-black text-white">{stats.totalAttempted}</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalAttempted > 0 ? (stats.correctCount / stats.totalAttempted) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Waiting Animation */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full border-4 border-orange-500/30 flex items-center justify-center animate-pulse">
              <Target className="w-12 h-12 text-orange-500/60" />
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-orange-500/10 animate-ping" />
          </div>
          <p className="text-lg font-black text-white uppercase tracking-[0.2em] mb-2">WAITING FOR CAPTAIN</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">TO OPEN NEXT TASK</p>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>

        {/* Team members online */}
        <div className="shrink-0 p-4 border-t border-slate-800">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
            {liveMembers.length} TEAM MEMBERS ONLINE
          </p>
        </div>
      </div>
    );
  }

  // ===========================
  // TASK SCREEN
  // ===========================
  if (screen === 'TASK' && currentTask) {
    const sanitizedQuestion = DOMPurify.sanitize(currentTask.task.question);

    return (
      <div className="fixed inset-0 z-[4000] bg-[#0a0f1d] text-white flex flex-col">
        {/* Task Header */}
        <div className="shrink-0 p-4 border-b-2 border-orange-500/30 bg-black/30">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">NEW TASK</span>
          </div>
          <h1 className="text-lg font-black text-white uppercase tracking-wider truncate">
            {currentTask.title || 'TASK'}
          </h1>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Task Image */}
          {currentTask.task.imageUrl && (
            <div className="rounded-2xl overflow-hidden border-2 border-slate-700">
              <img
                src={currentTask.task.imageUrl}
                alt="Task"
                className="w-full max-h-48 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Question */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <div
              className="text-base text-white font-medium leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizedQuestion }}
            />
          </div>

          {/* Answer Input */}
          {renderAnswerInput()}
        </div>

        {/* Submit Button */}
        <div className="shrink-0 p-4 border-t-2 border-orange-500/30 bg-black/30">
          {currentTask.task.type === 'info' ? (
            <button
              onClick={() => {
                teamSync.castVote(currentTask.pointId, 'read');
                setHasVoted(true);
                setScreen('WAITING');
              }}
              className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-black text-lg uppercase tracking-[0.15em] flex items-center justify-center gap-3 shadow-2xl"
            >
              <CheckCircle className="w-6 h-6" />
              GOT IT
            </button>
          ) : (
            <button
              onClick={handleSubmitVote}
              disabled={!canSubmit()}
              className="w-full py-5 bg-gradient-to-r from-orange-600 to-red-600 disabled:from-slate-700 disabled:to-slate-700 text-white disabled:text-slate-500 rounded-2xl font-black text-lg uppercase tracking-[0.15em] flex items-center justify-center gap-3 shadow-2xl transition-all disabled:shadow-none"
            >
              <Send className="w-6 h-6" />
              SUBMIT VOTE
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===========================
  // WAITING SCREEN
  // ===========================
  if (screen === 'WAITING' && currentTask) {
    const voteProgress = Math.min(teamVotes.length / activeCount, 1);

    return (
      <div className="fixed inset-0 z-[4000] bg-[#0a0f1d] text-white flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-4 border-b-2 border-orange-500/30 bg-black/30 text-center">
          <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">YOUR VOTE IS IN</p>
          <h1 className="text-lg font-black text-white uppercase tracking-wider mt-1">{currentTask.title}</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Progress Circle */}
          <div className="relative w-36 h-36 mb-8">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none" stroke="#f97316" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${voteProgress * 283} 283`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-black text-orange-400">{teamVotes.length}/{activeCount}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">VOTED</p>
            </div>
          </div>

          {/* Member vote status */}
          <div className="w-full max-w-sm space-y-2 mb-8">
            {liveMembers.map(m => {
              const hasVotedM = votedDeviceIds.has(m.deviceId);
              return (
                <div
                  key={m.deviceId}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    hasVotedM
                      ? 'bg-green-900/20 border-green-500/30'
                      : 'bg-slate-800/30 border-slate-700/30 opacity-60'
                  }`}
                >
                  {hasVotedM ? (
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <CircleDot className="w-5 h-5 text-slate-500 shrink-0 animate-pulse" />
                  )}
                  <span className="text-sm font-bold text-white uppercase tracking-wider truncate">
                    {m.userName || 'Unknown'}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ml-auto ${hasVotedM ? 'text-green-500' : 'text-slate-500'}`}>
                    {hasVotedM ? 'VOTED' : 'WAITING'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Waiting for captain */}
          <div className="text-center">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-2">
              WAITING FOR CAPTAIN TO DECIDE
            </p>
            <div className="flex gap-1.5 justify-center">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===========================
  // RESULT SCREEN
  // ===========================
  if (screen === 'RESULT' && taskResult) {
    return (
      <div className={`fixed inset-0 z-[4000] flex flex-col ${
        taskResult.isCorrect ? 'bg-[#051a0a]' : 'bg-[#1a0505]'
      }`}>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Result Icon */}
          <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 ${
            showResultAnimation ? 'animate-in zoom-in-50 duration-500' : ''
          } ${
            taskResult.isCorrect
              ? 'bg-green-500/20 border-4 border-green-500 shadow-[0_0_60px_rgba(34,197,94,0.3)]'
              : 'bg-red-500/20 border-4 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.3)]'
          }`}>
            {taskResult.isCorrect ? (
              <CheckCircle className="w-16 h-16 text-green-400" />
            ) : (
              <XCircle className="w-16 h-16 text-red-400" />
            )}
          </div>

          {/* Result Text */}
          <h1 className={`text-4xl font-black uppercase tracking-[0.2em] mb-2 ${
            taskResult.isCorrect ? 'text-green-400' : 'text-red-400'
          }`}>
            {taskResult.isCorrect ? 'CORRECT!' : 'INCORRECT'}
          </h1>

          {/* Points */}
          {taskResult.pointsAwarded > 0 && (
            <div className="bg-orange-500/20 border border-orange-500/40 rounded-2xl px-6 py-3 mb-6">
              <p className="text-2xl font-black text-orange-400">+{taskResult.pointsAwarded} PTS</p>
            </div>
          )}

          {/* Show correct answer if incorrect */}
          {!taskResult.isCorrect && taskResult.correctAnswer !== undefined && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 mb-6 max-w-sm w-full">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CORRECT ANSWER</p>
              <p className="text-lg font-black text-white">
                {Array.isArray(taskResult.correctAnswer) ? taskResult.correctAnswer.join(', ') : String(taskResult.correctAnswer)}
              </p>
            </div>
          )}

          {/* Team answer */}
          {taskResult.agreedAnswer !== undefined && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 mb-6 max-w-sm w-full">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TEAM ANSWER</p>
              <p className="text-lg font-black text-white">
                {Array.isArray(taskResult.agreedAnswer) ? taskResult.agreedAnswer.join(', ') : String(taskResult.agreedAnswer)}
              </p>
            </div>
          )}

          {/* Running Stats */}
          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <p className="text-2xl font-black text-green-400">{stats.correctCount}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase">CORRECT</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-red-400">{stats.incorrectCount}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase">INCORRECT</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-orange-400">{stats.pointsEarned}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase">TOTAL PTS</p>
            </div>
          </div>
        </div>

        {/* OK Button */}
        <div className="shrink-0 p-4 border-t border-slate-800">
          <button
            onClick={() => {
              setCurrentTask(null);
              setTaskResult(null);
              setShowResultAnimation(false);
              setScreen('LOBBY');
            }}
            className={`w-full py-5 rounded-2xl font-black text-xl uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl ${
              taskResult.isCorrect
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  // Fallback — should not reach
  return (
    <div className="fixed inset-0 z-[4000] bg-[#0a0f1d] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
    </div>
  );
};

export default PlayerPlayView;
