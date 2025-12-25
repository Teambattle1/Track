
import React, { useState, useEffect, useMemo } from 'react';
import { GamePoint, TaskVote, GameMode } from '../types';
import { X, CheckCircle, Lock, MapPin, Glasses, AlertCircle, ChevronDown, ChevronsUpDown, Users, AlertTriangle, Loader2, ThumbsUp, Zap, Edit2, Skull } from 'lucide-react';
import { teamSync } from '../services/teamSync';

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
    onTaskIncorrect
}) => {
  const [answer, setAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState<number>(point?.task.range?.min || 0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Voting State
  const [isVoting, setIsVoting] = useState(false);
  const [teamVotes, setTeamVotes] = useState<TaskVote[]>([]);
  const [memberCount, setMemberCount] = useState(1); // Self is 1

  // Manual Unlock State
  const [unlockCode, setUnlockCode] = useState('');
  const [showUnlockInput, setShowUnlockInput] = useState(false);
  const [unlockError, setUnlockError] = useState(false);

  const isEditMode = mode === GameMode.EDIT;
  const isInstructor = isInstructorMode || mode === GameMode.INSTRUCTOR;
  const isPlayground = !!point?.playgroundId;

  const hasActions = useMemo(() => {
      if (!point?.logic) return false;
      return (point.logic.onOpen?.length || 0) > 0 || 
             (point.logic.onCorrect?.length || 0) > 0 || 
             (point.logic.onIncorrect?.length || 0) > 0;
  }, [point]);

  // Check for DOUBLE TROUBLE
  const isDoubleTrouble = useMemo(() => {
      return point?.logic?.onOpen?.some(action => action.type === 'double_trouble');
  }, [point]);

  // Logic Trigger: ON OPEN & Status Update
  useEffect(() => {
      if (point && !isEditMode && !isInstructor) {
          // Trigger the open logic (e.g. locks, messages, etc.)
          if (onTaskOpen) onTaskOpen();
          // Update status to solving
          teamSync.updateStatus(true);
      }

      return () => {
          if (!isEditMode && !isInstructor) {
              teamSync.updateStatus(false);
          }
      };
  }, [point?.id, isEditMode, isInstructor]);

  // Subscribe to Realtime Updates
  useEffect(() => {
      if (!point || isEditMode || isInstructor) return; // Don't sync votes in edit/instructor mode
      
      const unsubscribeVotes = teamSync.subscribeToVotes((votes) => {
          setTeamVotes(votes);
      });
      
      const unsubscribeMembers = teamSync.subscribeToMemberCount((count) => {
          setMemberCount(Math.max(teamSync.getVotesForTask(point.id).length, 1)); 
      });

      // Load existing votes if any
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
  }, [point, isEditMode, isInstructor]);

  if (!point) return null;

  // Playground tasks are always unlocked when clicked
  // Instructor mode treats all tasks as unlocked for viewing
  const isLocked = !point.isUnlocked && !isInstructor && !isEditMode && !isPlayground;

  // --- Logic for Agreement ---
  const checkConsensus = () => {
      if (teamVotes.length === 0) return false;
      const firstAnswer = JSON.stringify(teamVotes[0].answer);
      return teamVotes.every(v => JSON.stringify(v.answer) === firstAnswer);
  };

  const consensusReached = checkConsensus();
  const hasConflict = teamVotes.length > 1 && !consensusReached;
  const myDeviceId = teamSync.getDeviceId();

  const handleSubmitVote = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let finalAnswer: any = answer;
    if (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') {
        finalAnswer = selectedOptions;
    } else if (point.task.type === 'slider') {
        finalAnswer = sliderValue;
    }

    teamSync.castVote(point.id, finalAnswer);
    setIsVoting(true);
  };

  const handleFinalize = () => {
      const agreedAnswer = teamVotes[0].answer;
      let isCorrect = false;

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
          const val = agreedAnswer as string;
          const correct = point.task.answer || '';
          isCorrect = val.toLowerCase().trim() === correct.toLowerCase().trim();
      }

      if (isCorrect) {
          const finalScore = isDoubleTrouble ? point.points * 2 : point.points;
          onComplete(point.id, finalScore);
          onClose();
      } else {
          // Logic Trigger: ON INCORRECT
          if (onTaskIncorrect) onTaskIncorrect();

          if (isDoubleTrouble && onPenalty) {
              onPenalty(point.points);
              setErrorMsg(`DOUBLE TROUBLE! Incorrect answer. You lost ${point.points} points.`);
          } else {
              setErrorMsg("Team answer is incorrect. Try again!");
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

  const handleCheckboxChange = (opt: string) => {
      setSelectedOptions(prev => {
          if (prev.includes(opt)) return prev.filter(o => o !== opt);
          return [...prev, opt];
      });
      setErrorMsg(null);
  };

  const renderInput = () => {
      // ... (Implementation unchanged, omitted for brevity as it's just rendering logic)
      const { type, options, range, placeholder } = point.task;
      const isDisabled = isInstructor;

      if (isEditMode) {
          // Simplified editor view
          if (type === 'text') return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center text-sm italic text-gray-500">Text Input Field</div>;
          if (type === 'slider') return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center font-mono">SLIDER {range?.min} - {range?.max}</div>;
          if (type === 'boolean') return <div className="flex gap-2 opacity-80 pointer-events-none"><div className="flex-1 p-3 border rounded-xl text-center">True</div><div className="flex-1 p-3 border rounded-xl text-center">False</div></div>;
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
                            } ${isDisabled ? 'cursor-default opacity-100' : ''}`}
                          >
                             <span>{opt}</span>
                             {answer === opt && <div className="w-4 h-4 bg-orange-600 rounded-full" />}
                          </button>
                      ))}
                  </div>
              );
          // ... (Other cases same as previous file)
          default:
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
      }
  };

  const renderConsensusView = () => {
      // ... (Implementation unchanged)
      return (
          <div className="space-y-4 animate-in fade-in">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                  <h3 className="font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest text-xs mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Team Consensus ({teamVotes.length} Voted)
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {teamVotes.map((vote, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg text-sm border border-gray-100 dark:border-gray-700 shadow-sm">
                              <span className="font-bold text-gray-700 dark:text-gray-200">{vote.userName}</span>
                              <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                                  {typeof vote.answer === 'object' ? (Array.isArray(vote.answer) ? vote.answer.join(', ') : JSON.stringify(vote.answer)) : String(vote.answer)}
                              </span>
                          </div>
                      ))}
                  </div>
              </div>
              <div className="flex gap-3 pt-2">
                  <button 
                      onClick={() => setIsVoting(false)}
                      className="flex-1 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold uppercase tracking-wide text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                      Change My Vote
                  </button>
                  {consensusReached && (
                      <button 
                          onClick={handleFinalize}
                          className="flex-[2] py-3 bg-green-600 text-white rounded-xl font-bold uppercase tracking-wide text-xs hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20"
                      >
                          Finalize & Submit
                      </button>
                  )}
              </div>
          </div>
      );
  };

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
                    : (isPlayground ? 'Virtual Zone Task' : (point.isUnlocked ? 'You are at the location!' : `Distance: ${Math.round(distance)}m`))}
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
                                <button 
                                    type="submit" 
                                    className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-700"
                                >
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
                <p className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: point.task.question }} />
                
                {point.task.imageUrl ? (
                  <div className="mt-4 rounded-lg overflow-hidden shadow-sm">
                    <img src={point.task.imageUrl} alt="Task" className="w-full h-auto object-cover max-h-60" />
                  </div>
                ) : null}
              </div>

              {(isInstructor || isEditMode) && (
                <div className="mb-6 bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800 rounded-lg p-3 animate-in fade-in">
                  <span className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider">Solution</span>
                  <p className="text-orange-900 dark:text-orange-200 font-medium mt-1">
                      {point.task.type === 'slider' 
                        ? `Target: ${point.task.range?.correctValue} (Range: ${point.task.range?.min}-${point.task.range?.max})`
                        : (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown' ? point.task.correctAnswers?.join(', ') : point.task.answer)}
                  </p>
                </div>
              )}

              {/* EDITOR ACTION BUTTON */}
              {isEditMode && onOpenActions && (
                  <button 
                      onClick={onOpenActions}
                      className="relative w-full mb-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg overflow-hidden group"
                  >
                      <Zap className="w-5 h-5" /> LOGIC & ACTIONS
                      {hasActions && (
                          <div className="absolute top-0 right-0 p-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_8px_2px_rgba(239,68,68,0.8)] animate-pulse" />
                          </div>
                      )}
                  </button>
              )}

              {!point.isCompleted && !isEditMode ? (
                isInstructor ? (
                    // Instructor Read-Only View
                    <div className="opacity-80 pointer-events-none">
                        {renderInput()}
                        <div className="mt-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Task Preview Mode
                        </div>
                    </div>
                ) : (
                    isVoting ? renderConsensusView() : (
                        <form onSubmit={handleSubmitVote} className="space-y-4">
                        
                        {renderInput()}

                        {errorMsg && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4" /> {errorMsg}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-orange-600/20 mt-4"
                        >
                            Submit to Team
                        </button>
                        </form>
                    )
                )
              ) : (!isEditMode && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <p className="text-green-800 dark:text-green-300 font-medium">Task Completed!</p>
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
