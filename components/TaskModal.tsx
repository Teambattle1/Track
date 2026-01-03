import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GamePoint, TaskVote, GameMode, TimelineItem, Game } from '../types';
import { X, CheckCircle, Lock, MapPin, Glasses, AlertCircle, ChevronDown, ChevronsUpDown, Users, AlertTriangle, Loader2, ThumbsUp, Zap, Edit2, Skull, ArrowRight, ArrowDown, Lightbulb, Shield, Camera, Video, Upload } from 'lucide-react';
import { teamSync } from '../services/teamSync';
import DOMPurify from 'dompurify';
import { isAnswerAcceptable, getAttemptMessage } from '../utils/stringMatch';
import { playSound, getGlobalCorrectSound, getGlobalIncorrectSound, getGlobalVolume } from '../utils/sounds';
import { uploadMediaFile, createMediaSubmission } from '../services/mediaUpload';
import { replacePlaceholders } from '../utils/placeholders';

interface TaskModalProps {
  point: GamePoint | null;
  onClose: () => void;
  onComplete: (pointId: string, customScore?: number) => void;
  onPenalty?: (amount: number) => void;
  onUnlock?: (pointId: string) => void;
  distance: number;
  isInstructorMode?: boolean;
  mode?: GameMode;
  onOpenActions?: () => void;
  onTaskOpen?: () => void;
  onTaskIncorrect?: () => void;
  game?: Game | null;
  isCaptain?: boolean;
}

const TaskModal: React.FC<TaskModalProps> = ({
    point,
    onClose,
    onComplete,
    onPenalty,
    onUnlock,
    distance,
    isInstructorMode = false,
    mode,
    onOpenActions,
    onTaskOpen,
    onTaskIncorrect,
    game,
    isCaptain = false
}) => {
  // CRITICAL: Check for null point BEFORE any hooks to prevent crashes
  if (!point) return null;

  const [answer, setAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState<number>(point?.task.range?.min || 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);

  // Voting State
  const [isVoting, setIsVoting] = useState(false);
  const [teamVotes, setTeamVotes] = useState<TaskVote[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]); // Track all team members with retirement status

  // Manual Unlock State
  const [unlockCode, setUnlockCode] = useState('');
  const [showUnlockInput, setShowUnlockInput] = useState(false);
  const [unlockError, setUnlockError] = useState(false);

  // Timeline Task State
  const [timelinePlayedItems, setTimelinePlayedItems] = useState<TimelineItem[]>([]);
  const [timelineQueue, setTimelineQueue] = useState<TimelineItem[]>([]);
  const [timelineScore, setTimelineScore] = useState(0);
  const [timelineFinished, setTimelineFinished] = useState(false);
  const [lastPlacedStatus, setLastPlacedStatus] = useState<'correct' | 'incorrect' | null>(null);

  // Media Capture State (Photo/Video)
  const [capturedMedia, setCapturedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = mode === GameMode.EDIT;
  const isInstructor = isInstructorMode || mode === GameMode.INSTRUCTOR;
  const isSimulation = mode === GameMode.SIMULATION;
  const isPlayground = !!point?.playgroundId;

  // Double Trouble Logic
  const isDoubleTrouble = useMemo(() => {
      return point?.logic?.onOpen?.some(action => action.type === 'double_trouble');
  }, [point]);

  // Logic Trigger: ON OPEN & Status Update
  useEffect(() => {
      if (point && !isEditMode && !isInstructor) {
          if (onTaskOpen) onTaskOpen();
          // Don't update team sync status in simulation mode
          if (!isSimulation) teamSync.updateStatus(true);
      }
      // Initialize Timeline Game if applicable
      if (point?.task.type === 'timeline' && point.task.timelineItems) {
          const items = [...point.task.timelineItems];
          // We can shuffle queue or use order. Let's assume order for now, 
          // or pick the first one as "Anchor".
          if (items.length > 0) {
              const first = items.shift(); // First item is anchor
              if(first) setTimelinePlayedItems([first]);
              setTimelineQueue(items);
          }
      }

      return () => {
          if (!isEditMode && !isInstructor && !isSimulation) {
              teamSync.updateStatus(false);
          }
      };
  }, [point?.id, isEditMode, isInstructor, isSimulation]);

  // Subscribe to Realtime Updates
  useEffect(() => {
      if (!point || isEditMode || isInstructor || isSimulation) return;
      
      const unsubscribeVotes = teamSync.subscribeToVotesForTask(point.id, (votes) => {
          setTeamVotes(votes);
      });
      const unsubscribeMembers = teamSync.subscribeToMembers((members) => {
          setTeamMembers(members);
      });

      const existing = teamSync.getVotesForTask(point.id);
      if (existing.length > 0) {
          setTeamVotes(existing);
          const myId = teamSync.getDeviceId();
          const myVote = existing.find(v => v.deviceId === myId);
          if (myVote) {
              setIsVoting(true);
          }
      }

      return () => {
          unsubscribeVotes();
          unsubscribeMembers();
      };
  }, [point, isEditMode, isInstructor, isSimulation]);

  // UNLOCK LOGIC: Allow open if Unlocked OR Instructor OR Editor OR Playground OR Simulation
  const isLocked = !point.isUnlocked && !isInstructor && !isEditMode && !isPlayground && !isSimulation;

  const normalizeAnswerForConsensus = (a: any) => {
      if (Array.isArray(a)) return JSON.stringify([...a].sort());
      if (typeof a === 'string') return a.trim().toLowerCase();
      if (typeof a === 'number' && Number.isFinite(a)) return String(a);
      if (a && typeof a === 'object') return JSON.stringify(a);
      return String(a);
  };

  const checkConsensus = () => {
      if (teamVotes.length === 0) return false;

      // Count only active (non-retired) members
      const activeMembers = teamMembers.filter(m => !m.isRetired);
      const activeMemberCount = Math.max(activeMembers.length, 1);

      // Require everyone currently online (and not retired) to have voted.
      if (teamVotes.length < activeMemberCount) return false;

      const firstAnswer = normalizeAnswerForConsensus(teamVotes[0].answer);
      return teamVotes.every(v => normalizeAnswerForConsensus(v.answer) === firstAnswer);
  };

  const consensusReached = checkConsensus();

  // --- TIMELINE GAME LOGIC ---
  const handleTimelineDrop = (targetIndex: number) => {
      if (timelineQueue.length === 0) return;
      
      const currentItem = timelineQueue[0];
      const newPlayed = [...timelinePlayedItems];
      
      // Check if position is correct based on value
      // The item should be inserted at targetIndex.
      // Logic: Compare value with neighbors.
      // Left neighbor (if exists) must have value <= current
      // Right neighbor (if exists) must have value >= current
      // Assuming sorting Low -> High.
      
      const prevItem = targetIndex > 0 ? newPlayed[targetIndex - 1] : null;
      const nextItem = targetIndex < newPlayed.length ? newPlayed[targetIndex] : null;
      
      const isCorrect = 
          (!prevItem || prevItem.value <= currentItem.value) && 
          (!nextItem || nextItem.value >= currentItem.value);

      if (isCorrect) {
          newPlayed.splice(targetIndex, 0, currentItem);
          setTimelinePlayedItems(newPlayed);
          setTimelineScore(prev => prev + (point.points / (point.task.timelineItems?.length || 1))); // Distribute points
          setLastPlacedStatus('correct');
      } else {
          // Find correct index
          let correctIndex = 0;
          for (let i = 0; i < newPlayed.length; i++) {
              if (currentItem.value < newPlayed[i].value) {
                  correctIndex = i;
                  break;
              } else {
                  correctIndex = i + 1;
              }
          }
          newPlayed.splice(correctIndex, 0, currentItem);
          setTimelinePlayedItems(newPlayed);
          setLastPlacedStatus('incorrect');
      }

      const newQueue = [...timelineQueue];
      newQueue.shift();
      setTimelineQueue(newQueue);

      setTimeout(() => setLastPlacedStatus(null), 1500);

      if (newQueue.length === 0) {
          // Game Over
          setTimelineFinished(true);
      }
  };

  const handleTimelineFinish = () => {
      // Calculate total score based on timelineScore accumulator
      // For now, assume simplified scoring: if finished, you get points earned.
      // If we want pass/fail, we check a threshold. Here we give accumulated points.
      onComplete(point.id, Math.round(timelineScore));
      onClose();
  };

  // --- STANDARD TASK LOGIC ---
  const handleSubmitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Handle Photo/Video tasks
    if (point.task.type === 'photo' || point.task.type === 'video') {
        if (!capturedMedia) {
            setErrorMsg(`Please ${point.task.type === 'photo' ? 'take a photo' : 'record a video'} before submitting.`);
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Get team info from teamSync
            const teamState = teamSync.getState();
            const teamId = teamState?.teamId || 'unknown-team';
            const teamName = teamState?.teamName || 'Unknown Team';
            const gameId = game?.id || 'unknown-game';

            // Upload the file
            setUploadProgress(30);
            const mediaUrl = await uploadMediaFile(capturedMedia, gameId, teamId);

            setUploadProgress(60);
            // Create submission record
            const submission = await createMediaSubmission(
                gameId,
                teamId,
                teamName,
                point.id,
                point.title,
                mediaUrl,
                point.task.type
            );

            setUploadProgress(100);

            // Check if auto-approve or requires approval
            const requiresApproval = point.task.mediaSettings?.requireApproval !== false;

            if (requiresApproval) {
                // Show pending message
                alert(`📸 ${point.task.type === 'photo' ? 'Photo' : 'Video'} submitted!\n\nYour submission is pending instructor approval. You'll be notified once it's reviewed.`);
                onClose();
            } else {
                // Auto-approve: Award points immediately
                const finalScore = isDoubleTrouble ? point.points * 2 : point.points;
                onComplete(point.id, finalScore);
                onClose();
            }

            return;
        } catch (error: any) {
            console.error('Media upload failed:', error);
            setErrorMsg(`Upload failed: ${error.message || 'Please try again.'}`);
            setIsUploading(false);
            setUploadProgress(0);
            return;
        }
    }

    let finalAnswer: any = answer;
    if (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') {
        finalAnswer = selectedOptions;
    } else if (point.task.type === 'slider') {
        finalAnswer = sliderValue;
    }

    // In simulation mode, bypass team sync voting and go straight to finalize
    if (isSimulation) {
        // Simulate a vote object locally just for the logic flow, or refactor
        // Actually, let's just trigger finalize immediately with local answer
        // Mock teamVotes for handleFinalize to consume
        const mockVote: TaskVote = {
            deviceId: 'sim',
            userName: 'Simulator',
            pointId: point.id,
            answer: finalAnswer,
            timestamp: Date.now()
        };
        // Hack: set state then call finalize immediately won't work due to closure.
        // Instead, refactor handleFinalize or create a specialized handleSimulateSubmit
        handleSimulateSubmit(finalAnswer);
        return;
    }

    teamSync.castVote(point.id, finalAnswer);
    setIsVoting(true);
  };

  const handleSimulateSubmit = (submittedAnswer: any) => {
      // Direct validation logic for simulation
      let isCorrect = false;
      const maxAttempts = point.settings?.maxAttempts ?? 1;
      const matchTolerance = point.settings?.matchTolerance ?? 80;
      const language = point.settings?.language || 'English';

      if (point.task.type === 'multiple_choice' || point.task.type === 'boolean' || point.task.type === 'dropdown') {
          isCorrect = submittedAnswer === point.task.answer;
      }
      else if (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') {
          const correct = point.task.correctAnswers || [];
          const sortedSelected = [...(submittedAnswer as string[])].sort();
          const sortedCorrect = [...correct].sort();
          isCorrect = JSON.stringify(sortedSelected) === JSON.stringify(sortedCorrect);
      }
      else if (point.task.type === 'slider') {
          const val = submittedAnswer as number;
          const target = point.task.range?.correctValue || 0;
          const tolerance = point.task.range?.tolerance || 0;
          isCorrect = Math.abs(val - target) <= tolerance;
      }
      else {
          // Text answer with fuzzy matching
          const val = submittedAnswer as string;
          const correct = point.task.answer || '';
          isCorrect = isAnswerAcceptable(val, correct, matchTolerance, false);
      }

      if (isCorrect) {
          // Play correct answer sound
          const correctSoundUrl = game?.soundSettings?.correctAnswerSound || getGlobalCorrectSound();
          const volume = game?.soundSettings?.volume ?? getGlobalVolume();
          playSound(correctSoundUrl, volume);

          const finalScore = isDoubleTrouble ? point.points * 2 : point.points;
          onComplete(point.id, finalScore);
          onClose();
      } else {
          const newAttemptsUsed = attemptsUsed + 1;
          setAttemptsUsed(newAttemptsUsed);

          if (onTaskIncorrect) onTaskIncorrect();

          // Play incorrect answer sound
          const incorrectSoundUrl = game?.soundSettings?.incorrectAnswerSound || getGlobalIncorrectSound();
          const volume = game?.soundSettings?.volume ?? getGlobalVolume();
          playSound(incorrectSoundUrl, volume);

          // Vibrate on incorrect answer
          if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]); // Short double buzz pattern for incorrect answer
          }

          // Check if attempts exhausted
          const attemptsRemaining = maxAttempts > 0 ? maxAttempts - newAttemptsUsed : 999;
          const attemptsExhausted = maxAttempts > 0 && newAttemptsUsed >= maxAttempts;

          // If attempts exhausted, auto-close and mark as incorrect
          if (attemptsExhausted) {
              // Trigger incorrect completion without showing message
              // Note: onComplete is not called, task should remain incomplete or be handled by completionLogic
              onClose();
              return;
          }

          // Build error message (only if attempts remain)
          let incorrectMsg = point.feedback?.showIncorrectMessage && point.feedback.incorrectMessage
              ? point.feedback.incorrectMessage
              : (isDoubleTrouble
                  ? `DOUBLE TROUBLE! Incorrect answer. You lost ${point.points} points.`
                  : "Incorrect answer in simulation.");

          // Add attempts message
          if (maxAttempts > 0) {
              incorrectMsg += ` ${getAttemptMessage(language, attemptsRemaining)}`;
          }

          if (isDoubleTrouble && onPenalty) {
              onPenalty(point.points);
          }

          setErrorMsg(incorrectMsg);

          // Show correct answer if configured
          if (point.settings?.showCorrectAnswerOnMiss) {
              setShowCorrectAnswer(true);
          }

          // Clear answer field
          setAnswer('');
      }
  }

  const handleFinalize = () => {
      const agreedAnswer = teamVotes[0].answer;
      let isCorrect = false;
      const maxAttempts = point.settings?.maxAttempts ?? 1;
      const matchTolerance = point.settings?.matchTolerance ?? 80;
      const language = point.settings?.language || 'English';

      if (point.task.type === 'multiple_choice' || point.task.type === 'boolean' || point.task.type === 'dropdown') {
          isCorrect = agreedAnswer === point.task.answer;
      }
      else if (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') {
          const correct = point.task.correctAnswers || [];
          const sortedSelected = [...(agreedAnswer as string[])].sort();
          const sortedCorrect = [...correct].sort();
          isCorrect = JSON.stringify(sortedSelected) === JSON.stringify(sortedCorrect);
      }
      else if (point.task.type === 'slider') {
          const val = agreedAnswer as number;
          const target = point.task.range?.correctValue || 0;
          const tolerance = point.task.range?.tolerance || 0;
          isCorrect = Math.abs(val - target) <= tolerance;
      }
      else {
          // Text answer with fuzzy matching
          const val = agreedAnswer as string;
          const correct = point.task.answer || '';
          isCorrect = isAnswerAcceptable(val, correct, matchTolerance, false);
      }

      if (isCorrect) {
          // Play correct answer sound
          const correctSoundUrl = game?.soundSettings?.correctAnswerSound || getGlobalCorrectSound();
          const volume = game?.soundSettings?.volume ?? getGlobalVolume();
          playSound(correctSoundUrl, volume);

          const finalScore = isDoubleTrouble ? point.points * 2 : point.points;
          onComplete(point.id, finalScore);
          onClose();
      } else {
          const newAttemptsUsed = attemptsUsed + 1;
          setAttemptsUsed(newAttemptsUsed);

          if (onTaskIncorrect) onTaskIncorrect();

          // Play incorrect answer sound
          const incorrectSoundUrl = game?.soundSettings?.incorrectAnswerSound || getGlobalIncorrectSound();
          const volume = game?.soundSettings?.volume ?? getGlobalVolume();
          playSound(incorrectSoundUrl, volume);

          // Vibrate on incorrect answer
          if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]); // Short double buzz pattern for incorrect answer
          }

          // Check if attempts exhausted
          const attemptsRemaining = maxAttempts > 0 ? maxAttempts - newAttemptsUsed : 999;
          const attemptsExhausted = maxAttempts > 0 && newAttemptsUsed >= maxAttempts;

          // If attempts exhausted, auto-close and mark as incorrect
          if (attemptsExhausted) {
              // Trigger incorrect completion without showing message
              onClose();
              return;
          }

          // Build error message (only if attempts remain)
          let incorrectMsg = point.feedback?.showIncorrectMessage && point.feedback.incorrectMessage
              ? point.feedback.incorrectMessage
              : (isDoubleTrouble
                  ? `DOUBLE TROUBLE! Incorrect answer. You lost ${point.points} points.`
                  : "Team answer is incorrect.");

          // Add attempts message
          if (maxAttempts > 0) {
              incorrectMsg += ` ${getAttemptMessage(language, attemptsRemaining)}`;
          }

          if (isDoubleTrouble && onPenalty) {
              onPenalty(point.points);
          }

          setErrorMsg(incorrectMsg);

          // Show correct answer if configured
          if (point.settings?.showCorrectAnswerOnMiss) {
              setShowCorrectAnswer(true);
          }
          setIsVoting(false);
      }
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (point.manualUnlockCode && unlockCode === point.manualUnlockCode) {
          if (onUnlock) onUnlock(point.id);
      } else {
          setUnlockError(true);
          setTimeout(() => setUnlockError(false), 2000);
      }
  };

  const handleRevealHint = () => {
      if (!hintRevealed && point.feedback?.hint) {
          const cost = point.feedback.hintCost || -50;
          if (onPenalty) onPenalty(Math.abs(cost)); // Ensure positive value for penalty
          setHintRevealed(true);
      }
  };

  const renderConsensusView = () => {
      // Count only active (non-retired) members
      const activeMembers = teamMembers.filter(m => !m.isRetired);
      const activeMemberCount = Math.max(activeMembers.length, 1);

      // Group votes by answer to show distribution
      const voteGroups: Record<string, string[]> = {};
      teamVotes.forEach(v => {
          let ansStr = String(v.answer);
          if (typeof v.answer === 'object') {
              if (Array.isArray(v.answer)) {
                  ansStr = JSON.stringify([...v.answer].sort());
              } else {
                  ansStr = JSON.stringify(v.answer);
              }
          }
          if (!voteGroups[ansStr]) voteGroups[ansStr] = [];
          voteGroups[ansStr].push(v.userName);
      });

      // Find who hasn't voted yet
      const votedDeviceIds = new Set(teamVotes.map(v => v.deviceId));
      const notVotedYet = activeMembers.filter(m => !votedDeviceIds.has(m.deviceId));

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4 animate-pulse">
                      <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-black uppercase text-gray-900 dark:text-white">TEAM CONSENSUS</h3>
                  <p className="text-sm text-gray-500 font-bold">
                      {teamVotes.length} / {activeMemberCount} VOTES CAST
                  </p>
                  {notVotedYet.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                          Waiting for: {notVotedYet.map(m => m.userName).join(', ')}
                      </p>
                  )}
              </div>

              <div className="space-y-3">
                  {Object.entries(voteGroups).map(([ansStr, users], idx) => {
                      let displayAns = ansStr;
                      try {
                          if (ansStr.startsWith('[') || ansStr.startsWith('{')) {
                              const parsed = JSON.parse(ansStr);
                              if (Array.isArray(parsed)) displayAns = parsed.join(', ');
                              else displayAns = JSON.stringify(parsed);
                          }
                      } catch {}
                      
                      const isConsensus = consensusReached && Object.keys(voteGroups).length === 1;

                      return (
                          <div key={idx} className={`p-4 rounded-xl border-2 transition-colors ${isConsensus ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                              <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-gray-900 dark:text-white break-all">{displayAns}</span>
                                  <span className="text-xs font-black bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">{users.length} VOTES</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                  {users.map((u, i) => (
                                      <span key={i} className="text-[10px] uppercase font-bold text-gray-500 bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                          {u}
                                      </span>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
              </div>

              {/* Hint Button in Consensus View */}
              {point.feedback?.hint && !hintRevealed && (
                  <button
                      type="button"
                      onClick={handleRevealHint}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2"
                  >
                      <Lightbulb className="w-5 h-5" />
                      HINT ({point.feedback.hintCost || -50} points)
                  </button>
              )}

              {/* Show Revealed Hint in Consensus View */}
              {hintRevealed && point.feedback?.hint && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                              Hint:
                          </p>
                      </div>
                      <p className="text-yellow-900 dark:text-yellow-200 font-medium">
                          {point.feedback.hint}
                      </p>
                  </div>
              )}

              {consensusReached ? (
                  <button
                      onClick={handleFinalize}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all"
                  >
                      <ThumbsUp className="w-5 h-5" /> SUBMIT FINAL ANSWER
                  </button>
              ) : (
                  <>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl flex items-center gap-3 border border-yellow-200 dark:border-yellow-800">
                          <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                          <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase">WAITING FOR TEAM AGREEMENT...</p>
                      </div>

                      {/* Captain can submit without consensus if voting mode allows */}
                      {isCaptain && game?.taskConfig?.teamVotingMode === 'captain_submit' && teamVotes.length > 0 && (
                          <button
                              onClick={handleFinalize}
                              className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold uppercase flex items-center justify-center gap-2 transition-all"
                          >
                              <Shield className="w-4 h-4" /> CAPTAIN SUBMIT (Override)
                          </button>
                      )}
                  </>
              )}

              <button
                  type="button"
                  onClick={() => setIsVoting(false)}
                  className="w-full py-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold uppercase text-xs transition-colors"
              >
                  CHANGE MY VOTE
              </button>
          </div>
      );
  };

  const renderInput = () => {
      const { type, options, range } = point.task;
      const isDisabled = isInstructor;

      if (isEditMode) {
          if (type === 'timeline') return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center text-sm font-mono uppercase">TIMELINE GAME PREVIEW</div>;
          if (type === 'text') return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center text-sm italic text-gray-500">Text Input Field</div>;
          if (type === 'slider') return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center font-mono">SLIDER {range?.min} - {range?.max}</div>;
          if (type === 'boolean') return <div className="flex gap-2 opacity-80 pointer-events-none"><div className="flex-1 p-3 border rounded-xl text-center">True</div><div className="flex-1 p-3 border rounded-xl text-center">False</div></div>;
          if (type === 'photo') return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center text-sm font-mono uppercase flex items-center justify-center gap-2"><Camera className="w-5 h-5" /> PHOTO UPLOAD</div>;
          if (type === 'video') return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center text-sm font-mono uppercase flex items-center justify-center gap-2"><Video className="w-5 h-5" /> VIDEO UPLOAD</div>;
          return (
              <div className="space-y-2 opacity-80 pointer-events-none">
                  {options?.map((opt, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{opt}</div>
                  ))}
              </div>
          );
      }

      switch(type) {
          case 'multiple_choice':
              return (
                  <div className="space-y-3">
                      {options?.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => { setAnswer(opt); setErrorMsg(null); }}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                                answer === opt 
                                ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/50 text-orange-900 dark:text-orange-200 font-bold' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                             <span>{opt}</span>
                             {answer === opt && <div className="w-4 h-4 bg-orange-600 rounded-full" />}
                          </button>
                      ))}
                  </div>
              );
          case 'text':
              return (
                <input
                    type="text"
                    disabled={isDisabled}
                    value={answer}
                    onChange={(e) => { setAnswer(e.target.value); setErrorMsg(null); }}
                    placeholder="Type your answer here..."
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                    autoFocus={!isInstructor && !isEditMode}
                />
              );
          case 'boolean':
              return (
                  <div className="flex gap-3">
                      <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => { setAnswer('true'); setErrorMsg(null); }}
                          className={`flex-1 p-4 rounded-xl border-2 font-bold text-sm uppercase transition-all ${
                              answer === 'true'
                              ? 'border-green-600 bg-green-50 dark:bg-green-900/50 text-green-900 dark:text-green-200'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                          ✓ TRUE
                      </button>
                      <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => { setAnswer('false'); setErrorMsg(null); }}
                          className={`flex-1 p-4 rounded-xl border-2 font-bold text-sm uppercase transition-all ${
                              answer === 'false'
                              ? 'border-red-600 bg-red-50 dark:bg-red-900/50 text-red-900 dark:text-red-200'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                          ✗ FALSE
                      </button>
                  </div>
              );
          case 'checkbox':
          case 'multi_select_dropdown':
              return (
                  <div className="space-y-2">
                      {options?.map((opt, idx) => (
                          <label
                              key={idx}
                              className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                  selectedOptions.includes(opt)
                                  ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/50'
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                          >
                              <input
                                  type="checkbox"
                                  disabled={isDisabled}
                                  checked={selectedOptions.includes(opt)}
                                  onChange={(e) => {
                                      setErrorMsg(null);
                                      if (e.target.checked) {
                                          setSelectedOptions([...selectedOptions, opt]);
                                      } else {
                                          setSelectedOptions(selectedOptions.filter(o => o !== opt));
                                      }
                                  }}
                                  className="w-5 h-5 rounded border-2 border-gray-300 text-orange-600 focus:ring-orange-500 focus:ring-2 disabled:bg-gray-100"
                              />
                              <span className="flex-1 text-gray-800 dark:text-gray-200">{opt}</span>
                          </label>
                      ))}
                  </div>
              );
          case 'dropdown':
              return (
                  <select
                      disabled={isDisabled}
                      value={answer}
                      onChange={(e) => { setAnswer(e.target.value); setErrorMsg(null); }}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                  >
                      <option value="">Select an answer...</option>
                      {options?.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                      ))}
                  </select>
              );
          case 'slider':
              return (
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{range?.min || 0}</span>
                          <span className="text-2xl font-black text-orange-600 dark:text-orange-400">{sliderValue}</span>
                          <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{range?.max || 100}</span>
                      </div>
                      <input
                          type="range"
                          disabled={isDisabled}
                          min={range?.min || 0}
                          max={range?.max || 100}
                          step={range?.step || 1}
                          value={sliderValue}
                          onChange={(e) => { setSliderValue(parseInt(e.target.value)); setErrorMsg(null); }}
                          className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600 disabled:opacity-50"
                      />
                  </div>
              );
          case 'photo':
          case 'video':
              const isPhoto = type === 'photo';
              const maxSize = point.task.mediaSettings?.maxFileSize || (isPhoto ? 10 : 50);

              const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  // Check file size
                  if (file.size > maxSize * 1024 * 1024) {
                      setErrorMsg(`File is too large! Maximum size is ${maxSize}MB.`);
                      return;
                  }

                  // Check file type
                  if (isPhoto && !file.type.startsWith('image/')) {
                      setErrorMsg('Please select a valid image file.');
                      return;
                  }
                  if (!isPhoto && !file.type.startsWith('video/')) {
                      setErrorMsg('Please select a valid video file.');
                      return;
                  }

                  setCapturedMedia(file);
                  setMediaPreview(URL.createObjectURL(file));
                  setErrorMsg(null);
              };

              const handleRemoveMedia = () => {
                  setCapturedMedia(null);
                  if (mediaPreview) {
                      URL.revokeObjectURL(mediaPreview);
                      setMediaPreview(null);
                  }
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  if (videoInputRef.current) videoInputRef.current.value = '';
              };

              return (
                  <div className="space-y-4">
                      {mediaPreview ? (
                          <div className="relative bg-black rounded-xl overflow-hidden border-2 border-green-500">
                              {isPhoto ? (
                                  <img
                                      src={mediaPreview}
                                      alt="Captured"
                                      className="w-full h-auto max-h-96 object-contain"
                                  />
                              ) : (
                                  <video
                                      src={mediaPreview}
                                      controls
                                      className="w-full h-auto max-h-96"
                                  />
                              )}
                              <button
                                  type="button"
                                  onClick={handleRemoveMedia}
                                  className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </div>
                      ) : (
                          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
                              <div className="flex flex-col items-center gap-4">
                                  {isPhoto ? (
                                      <Camera className="w-12 h-12 text-gray-400" />
                                  ) : (
                                      <Video className="w-12 h-12 text-gray-400" />
                                  )}
                                  <div>
                                      <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">
                                          {isPhoto ? 'Take or Upload Photo' : 'Record or Upload Video'}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                          Max size: {maxSize}MB
                                      </p>
                                  </div>
                                  <label className="cursor-pointer bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center gap-2">
                                      <Upload className="w-5 h-5" />
                                      {isPhoto ? 'Choose Photo' : 'Choose Video'}
                                      <input
                                          ref={isPhoto ? fileInputRef : videoInputRef}
                                          type="file"
                                          accept={isPhoto ? 'image/*' : 'video/*'}
                                          capture={isPhoto ? 'environment' : 'user'}
                                          onChange={handleFileSelect}
                                          className="hidden"
                                          disabled={isDisabled}
                                      />
                                  </label>
                              </div>
                          </div>
                      )}

                      {isUploading && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                              <div className="flex items-center gap-3 mb-2">
                                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                  <span className="font-bold text-blue-700 dark:text-blue-300">Uploading...</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                      className="bg-blue-600 h-full transition-all duration-300"
                                      style={{ width: `${uploadProgress}%` }}
                                  />
                              </div>
                          </div>
                      )}
                  </div>
              );
          default: return null;
      }
  };

  // --- TIMELINE RENDERER ---
  const renderTimelineGame = () => {
      const activeItem = timelineQueue[0];

      return (
          <div className="space-y-6">
              {/* CURRENT ITEM DECK */}
              <div className="flex justify-center mb-6 sticky top-0 z-20 bg-white dark:bg-gray-900 py-2 border-b border-gray-100 dark:border-gray-800">
                  {timelineFinished ? (
                      <div className="text-center">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                          <h3 className="text-lg font-black uppercase text-green-500">TIMELINE COMPLETE</h3>
                          <p className="text-sm font-bold text-gray-500">SCORE: {Math.round(timelineScore)} PTS</p>
                          <button onClick={handleTimelineFinish} className="mt-4 px-6 py-2 bg-green-600 text-white rounded-xl font-black uppercase">FINISH TASK</button>
                      </div>
                  ) : activeItem ? (
                      <div className="w-full max-w-sm bg-blue-600 text-white p-4 rounded-xl shadow-lg relative overflow-hidden">
                          <div className="flex gap-4 items-center">
                              {activeItem.imageUrl && <img src={activeItem.imageUrl} className="w-12 h-12 rounded-lg object-cover bg-white" />}
                              <div className="flex-1">
                                  <p className="text-[10px] font-black uppercase opacity-70 mb-1">PLACE THIS ITEM:</p>
                                  <h3 className="font-bold text-lg leading-tight">{activeItem.text}</h3>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="text-gray-400 font-bold uppercase text-xs">Loading...</div>
                  )}
              </div>

              {/* TIMELINE VISUAL */}
              <div className="relative pl-8 border-l-4 border-dashed border-gray-300 dark:border-gray-700 ml-4 space-y-4">
                  {timelinePlayedItems.map((item, idx) => {
                      // Insert Button BEFORE (only for index 0 or gaps if we allowed arbitrary insertion, but simpler to just show after each item)
                      // Logic: show drop zones between items
                      return (
                          <React.Fragment key={item.id}>
                              {/* Drop Zone Above (Only for first item) */}
                              {idx === 0 && !timelineFinished && (
                                  <button 
                                      onClick={() => handleTimelineDrop(0)}
                                      className="absolute -left-[14px] -top-6 w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full border-2 border-white dark:border-gray-600 flex items-center justify-center hover:scale-125 transition-transform z-10"
                                  >
                                      <ArrowDown className="w-3 h-3 text-gray-500" />
                                  </button>
                              )}

                              <div className={`relative p-3 rounded-xl border-2 flex gap-3 items-center bg-white dark:bg-gray-800 ${item.id === activeItem?.id && lastPlacedStatus === 'incorrect' ? 'border-red-500 animate-shake' : (item.id === activeItem?.id && lastPlacedStatus === 'correct' ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-200 dark:border-gray-700')}`}>
                                  {/* Dot on line */}
                                  <div className="absolute -left-[38px] top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-4 border-white dark:border-gray-900" />
                                  
                                  {item.imageUrl && <img src={item.imageUrl} className="w-12 h-12 rounded object-cover" />}
                                  <div className="flex-1">
                                      <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{item.text}</h4>
                                      <p className="text-xs text-gray-500">{item.description}</p>
                                  </div>
                                  <div className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono font-bold text-gray-600 dark:text-gray-300">
                                      {item.value}
                                  </div>
                              </div>

                              {/* Drop Zone Below */}
                              {!timelineFinished && (
                                  <div className="relative h-8 flex items-center">
                                      <button 
                                          onClick={() => handleTimelineDrop(idx + 1)}
                                          className="absolute -left-[14px] w-6 h-6 bg-blue-500 text-white rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center hover:scale-125 transition-transform z-10 shadow-lg"
                                      >
                                          <ArrowDown className="w-3 h-3" />
                                      </button>
                                      <div className="w-full border-t border-dashed border-gray-300 dark:border-gray-700 ml-[-20px] opacity-0" />
                                  </div>
                              )}
                          </React.Fragment>
                      );
                  })}
              </div>
          </div>
      );
  };

  // Get team name for placeholder replacement
  const teamState = teamSync.getState();
  const teamName = teamState?.teamName || 'Your Team';

  // Replace placeholders in task question
  const questionWithPlaceholders = replacePlaceholders(point.task.question, teamName);
  const sanitizedQuestion = DOMPurify.sanitize(questionWithPlaceholders);

  return (
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`p-6 ${point.isCompleted ? 'bg-green-100 dark:bg-green-900/30' : (!isLocked ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-800')}`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {point.isCompleted ? (
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-500" />
              ) : !isLocked ? (
                (isInstructor || isEditMode) ? <Glasses className="w-8 h-8 text-orange-600 dark:text-orange-400" /> : <MapPin className="w-8 h-8 text-orange-600 dark:text-orange-500" />
              ) : (
                <Lock className="w-8 h-8 text-red-500 dark:text-red-400" />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{point.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {isInstructor || isEditMode
                    ? (isEditMode ? 'Editor View' : 'Instructor View (Read Only)')
                    : (isSimulation ? 'SIMULATION MODE (GPS BYPASSED)' : (isPlayground ? 'Virtual Zone Task' : (point.isUnlocked ? 'You are at the location!' : `Distance: ${Math.round(distance)}m`)))}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 transition-colors">
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {isLocked ? (
            <div className="text-center py-8">
              <Lock className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                You need to get closer to unlock this task.
                <br />
                <strong>{Math.max(0, Math.round(distance - point.radiusMeters))} meters</strong> to go.
              </p>

              {point.manualUnlockCode && (
                  <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                      {!showUnlockInput ? (
                          <button 
                              onClick={() => setShowUnlockInput(true)} 
                              className="text-sm font-medium text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 underline"
                          >
                              Enter Fail-safe Code
                          </button>
                      ) : (
                          <form onSubmit={handleUnlockSubmit} className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom-2">
                              <label className="text-xs text-gray-500 font-bold">FAIL-SAFE UNLOCK</label>
                              <div className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    maxLength={4}
                                    placeholder="0000"
                                    value={unlockCode}
                                    onChange={(e) => setUnlockCode(e.target.value.replace(/[^0-9]/g, ''))}
                                    className={`w-24 text-center text-lg font-mono border-2 rounded-lg p-1 outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${unlockError ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 focus:border-orange-500'}`}
                                    autoFocus
                                />
                                <button type="submit" className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-700">
                                    Unlock
                                </button>
                              </div>
                              {unlockError && <span className="text-xs text-red-500 font-bold">Incorrect code</span>}
                          </form>
                      )}
                  </div>
              )}
            </div>
          ) : (
            <>
              {isDoubleTrouble && !point.isCompleted && !isEditMode && (
                  <div className="bg-red-600 text-white p-4 rounded-xl mb-6 shadow-lg animate-pulse flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-full"><Skull className="w-6 h-6" /></div>
                      <div>
                          <h3 className="font-black text-lg uppercase tracking-wider leading-none mb-1">DOUBLE TROUBLE!</h3>
                          <p className="text-xs font-bold uppercase opacity-90">
                              WIN {point.points * 2} PTS OR LOSE {point.points} PTS!
                          </p>
                      </div>
                  </div>
              )}

              <div className="prose prose-sm mb-6 dark:prose-invert">
                {/* SAFE HTML RENDERING */}
                <p className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: sanitizedQuestion }} />
                
                {point.task.imageUrl && (
                  <div className="mt-4 rounded-lg overflow-hidden shadow-sm">
                    <img src={point.task.imageUrl} alt="Task" className="w-full h-auto object-cover max-h-60" />
                  </div>
                )}
              </div>

              {(isInstructor || isEditMode) && point.task.type !== 'timeline' && (
                <>
                  {/* Question Type Badge */}
                  <div className="mb-4 flex gap-2 items-center flex-wrap">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {point.task.type === 'multiple_choice' ? '📋 Multiple Choice' :
                       point.task.type === 'text' ? '📝 Text Input' :
                       point.task.type === 'slider' ? '🎚️ Slider' :
                       point.task.type === 'boolean' ? '✓ True/False' :
                       point.task.type === 'timeline' ? '📅 Timeline' :
                       point.task.type === 'photo' ? '📸 Photo Task' :
                       point.task.type === 'video' ? '🎥 Video Task' :
                       point.task.type}
                    </span>
                  </div>

                  {/* Possible Answers (Multiple Choice, Checkbox, Radio, Dropdown) */}
                  {(point.task.type === 'multiple_choice' || point.task.type === 'checkbox' || point.task.type === 'radio' || point.task.type === 'dropdown') && point.task.options && (
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-3">Possible Answers</span>
                      <div className="space-y-2">
                        {point.task.options.map((option, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200">
                            {option}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Slider Range Display */}
                  {point.task.type === 'slider' && point.task.range && (
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-3">Answer Range</span>
                      <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="text-center flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">MIN</p>
                            <p className="text-lg font-black text-blue-600 dark:text-blue-400">{point.task.range.min}</p>
                          </div>
                          <div className="text-gray-300 px-4">to</div>
                          <div className="text-center flex-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">MAX</p>
                            <p className="text-lg font-black text-blue-600 dark:text-blue-400">{point.task.range.max}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Boolean Options Display */}
                  {point.task.type === 'boolean' && (
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-3">Possible Answers</span>
                      <div className="flex gap-2">
                        <div className="flex-1 p-2 rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 text-sm font-bold text-center text-green-600 dark:text-green-400">
                          TRUE
                        </div>
                        <div className="flex-1 p-2 rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 text-sm font-bold text-center text-red-600 dark:text-red-400">
                          FALSE
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Solution Block */}
                  <div className="mb-6 bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800 rounded-lg p-4 animate-in fade-in">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block mb-2">Solution / Correct Answer</span>
                    <p className="text-orange-900 dark:text-orange-200 font-medium">
                        {point.task.type === 'slider' ?
                          (point.task.range?.correctValue !== undefined ? `${point.task.range.correctValue}` : point.task.correctAnswer || "See logic") :
                          point.task.type === 'checkbox' || point.task.type === 'radio' ?
                          point.task.correctAnswers?.join(', ') || point.task.answer || "See logic" :
                          point.task.type === 'dropdown' ?
                          point.task.answer || point.task.correctAnswers?.[0] || "See logic" :
                          point.task.answer || point.task.correctAnswers?.join(', ') || (point.task.type === 'boolean' ? 'Check logic for bool answer' : "See logic")}
                    </p>
                  </div>
                </>
              )}

              {!point.isCompleted && !isEditMode ? (
                point.task.type === 'timeline' ? renderTimelineGame() : (
                    isInstructor ? (
                        <div className="opacity-80 pointer-events-none">
                            {renderInput()}
                            <div className="mt-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Task Preview Mode
                            </div>
                        </div>
                    ) : (
                        isVoting && !isSimulation ? renderConsensusView() : (
                            <form onSubmit={handleSubmitVote} className="space-y-4">
                            
                            {renderInput()}

                            {errorMsg && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-1">
                                    <AlertCircle className="w-4 h-4" /> {errorMsg}
                                </div>
                            )}

                            {/* Show Correct Answer when wrong */}
                            {showCorrectAnswer && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 animate-in slide-in-from-top-2">
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                                        Correct Answer:
                                    </p>
                                    <p className="text-blue-900 dark:text-blue-200 font-bold text-lg">
                                        {point.task.type === 'slider' ?
                                            (point.task.range?.correctValue !== undefined ? `${point.task.range.correctValue}` : point.task.answer || "Not specified") :
                                            point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown' ?
                                            point.task.correctAnswers?.join(', ') || point.task.answer || "Not specified" :
                                            point.task.answer || point.task.correctAnswers?.[0] || "Not specified"}
                                    </p>
                                </div>
                            )}

                            {/* Hint Button - Only show in team view if hint exists and not already revealed */}
                            {!isInstructor && !isSimulation && point.feedback?.hint && !hintRevealed && (
                                <button
                                    type="button"
                                    onClick={handleRevealHint}
                                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2"
                                >
                                    <Lightbulb className="w-5 h-5" />
                                    HINT ({point.feedback.hintCost || -50} points)
                                </button>
                            )}

                            {/* Show Revealed Hint */}
                            {hintRevealed && point.feedback?.hint && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 animate-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                        <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">
                                            Hint:
                                        </p>
                                    </div>
                                    <p className="text-yellow-900 dark:text-yellow-200 font-medium">
                                        {point.feedback.hint}
                                    </p>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-orange-600/20 mt-4"
                            >
                                {isSimulation ? 'SUBMIT (SIMULATION)' : 'Submit to Team'}
                            </button>

                            {/* Show Correct Answer at bottom in Simulation Mode */}
                            {isSimulation && (
                                <div className="mt-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
                                        📋 Correct Answer (Simulation):
                                    </p>
                                    <p className="text-purple-900 dark:text-purple-200 font-bold text-lg">
                                        {point.task.type === 'slider' ?
                                            (point.task.range?.correctValue !== undefined ? `${point.task.range.correctValue}` : point.task.answer || "Not specified") :
                                            point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown' ?
                                            point.task.correctAnswers?.join(', ') || point.task.answer || "Not specified" :
                                            point.task.answer || point.task.correctAnswers?.[0] || "Not specified"}
                                    </p>
                                </div>
                            )}
                            </form>
                        )
                    )
                )
              ) : (!isEditMode && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <p className="text-green-800 dark:text-green-300 font-medium">
                    {point.feedback?.showCorrectMessage && point.feedback.correctMessage
                      ? point.feedback.correctMessage
                      : "Task Completed!"}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">You earned {isDoubleTrouble ? point.points * 2 : point.points} points.</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
