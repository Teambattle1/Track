
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

  // Logic Trigger: ON OPEN
  useEffect(() => {
      if (point && !isEditMode && onTaskOpen) {
          // Trigger the open logic (e.g. locks, messages, etc.)
          onTaskOpen();
      }
  }, [point?.id, isEditMode]);

  // Subscribe to Realtime Updates
  useEffect(() => {
      if (!point || isEditMode) return; // Don't sync votes in edit mode
      
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
  }, [point, isEditMode]);

  if (!point) return null;

  const isLocked = !point.isUnlocked && !isInstructor && !isEditMode;

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

      if (isCorrect || isInstructor) {
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
      const { type, options, range, placeholder } = point.task;

      // In Edit mode, show options as read-only or simplified
      if (isEditMode) {
          if (type === 'multiple_choice' || type === 'checkbox' || type === 'dropdown' || type === 'multi_select_dropdown') {
              return (
                  <div className="space-y-2 opacity-80 pointer-events-none">
                      {options?.map((opt, idx) => (
                          <div key={idx} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                              {opt}
                          </div>
                      ))}
                  </div>
              );
          }
          if (type === 'boolean') {
              return <div className="flex gap-2 opacity-80 pointer-events-none"><div className="flex-1 p-3 border rounded-xl text-center">True</div><div className="flex-1 p-3 border rounded-xl text-center">False</div></div>;
          }
          if (type === 'slider') {
              return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center font-mono">SLIDER {range?.min} - {range?.max}</div>;
          }
          return <div className="p-4 border rounded-xl opacity-80 bg-gray-100 dark:bg-gray-800 text-center text-sm italic text-gray-500">Text Input Field</div>;
      }

      // Normal Gameplay Rendering
      switch(type) {
          case 'multiple_choice':
              return (
                  <div className="space-y-3">
                      {options?.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
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

          case 'checkbox':
              return (
                  <div className="space-y-3">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Select all that apply</div>
                      {options?.map((opt, idx) => {
                          const isSelected = selectedOptions.includes(opt);
                          return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleCheckboxChange(opt)}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                                    isSelected
                                    ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/50 text-orange-900 dark:text-orange-200 font-bold' 
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                <span>{opt}</span>
                                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${isSelected ? 'bg-orange-600 border-orange-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                            </button>
                          );
                      })}
                  </div>
              );

          case 'dropdown':
              return (
                  <div className="relative">
                      <select
                          value={answer}
                          onChange={(e) => { setAnswer(e.target.value); setErrorMsg(null); }}
                          className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-orange-600 outline-none appearance-none cursor-pointer"
                      >
                          <option value="" disabled>{placeholder || "Select an answer..."}</option>
                          {options?.map((opt, idx) => (
                              <option key={idx} value={opt}>{opt}</option>
                          ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                          <ChevronDown className="w-5 h-5" />
                      </div>
                  </div>
              );

          case 'multi_select_dropdown':
              return (
                  <div className="relative">
                      <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className={`w-full p-4 rounded-xl border-2 text-left flex items-center justify-between bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 ${isDropdownOpen ? 'border-orange-600 ring-1 ring-orange-600' : 'border-gray-200 dark:border-gray-700'}`}
                      >
                          <span className={selectedOptions.length === 0 ? "text-gray-400" : "text-gray-800 dark:text-gray-200"}>
                              {selectedOptions.length === 0 ? (placeholder || "Select options...") : `${selectedOptions.length} selected`}
                          </span>
                          <ChevronsUpDown className="w-5 h-5 text-gray-400" />
                      </button>
                      
                      {isDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto p-2 animate-in fade-in zoom-in-95 duration-100">
                              {options?.map((opt, idx) => {
                                  const isSelected = selectedOptions.includes(opt);
                                  return (
                                      <div 
                                          key={idx}
                                          onClick={() => handleCheckboxChange(opt)}
                                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-orange-50 dark:bg-orange-900/30' : ''}`}
                                      >
                                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${isSelected ? 'bg-orange-600 border-orange-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                          </div>
                                          <span className={isSelected ? 'font-medium text-orange-900 dark:text-orange-200' : 'text-gray-700 dark:text-gray-200'}>{opt}</span>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              );

          case 'boolean':
              return (
                  <div className="flex gap-4">
                      {['True', 'False'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => { setAnswer(val); setErrorMsg(null); }}
                            className={`flex-1 p-6 rounded-2xl border-2 text-xl font-bold transition-all ${
                                answer === val 
                                ? 'border-orange-600 bg-orange-600 text-white shadow-lg' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                              {val}
                          </button>
                      ))}
                  </div>
              );
            
          case 'slider':
              return (
                  <div className="py-6 px-2">
                      <div className="text-center mb-6">
                          <span className="text-4xl font-black text-orange-600 dark:text-orange-400">{sliderValue}</span>
                      </div>
                      <input 
                          type="range"
                          min={range?.min || 0}
                          max={range?.max || 100}
                          step={range?.step || 1}
                          value={sliderValue}
                          onChange={(e) => { setSliderValue(parseInt(e.target.value)); setErrorMsg(null); }}
                          className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                      />
                      <div className="flex justify-between text-gray-500 text-sm mt-2 font-medium">
                          <span>{range?.min}</span>
                          <span>{range?.max}</span>
                      </div>
                  </div>
              );

          default: // Text
              return (
                <input 
                    type="text" 
                    value={answer}
                    onChange={(e) => { setAnswer(e.target.value); setErrorMsg(null); }}
                    placeholder="Type your answer here..."
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    autoFocus={!isInstructor && !isEditMode}
                />
              );
      }
  };

  const renderConsensusView = () => {
      // Group votes by answer
      const groupedVotes: Record<string, TaskVote[]> = {};
      
      teamVotes.forEach(vote => {
          const answerKey = Array.isArray(vote.answer) ? vote.answer.sort().join(', ') : String(vote.answer);
          if (!groupedVotes[answerKey]) groupedVotes[answerKey] = [];
          groupedVotes[answerKey].push(vote);
      });

      return (
      <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" /> Team Decisions
                  </h3>
                  <div className="text-xs font-bold px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                      {teamVotes.length} Voted
                  </div>
              </div>
              
              <div className="space-y-3">
                  {Object.entries(groupedVotes).map(([answerKey, votes]) => {
                      const isMyVoteGroup = votes.some(v => v.deviceId === myDeviceId);
                      return (
                          <div key={answerKey} className={`rounded-xl border p-3 ${isMyVoteGroup ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600'}`}>
                              <div className="flex justify-between items-start mb-2">
                                  <div className="font-bold text-lg text-gray-900 dark:text-white break-words flex-1 pr-2">
                                      {answerKey}
                                  </div>
                                  <div className="bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-bold px-2 py-0.5 rounded text-xs">
                                      {votes.length}
                                  </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                  {votes.map((v, i) => (
                                      <span key={i} className="text-[10px] px-2 py-1 bg-white/50 dark:bg-black/20 rounded-full text-gray-600 dark:text-gray-300 border border-black/5 dark:border-white/10">
                                          {v.userName || "Unknown"}
                                      </span>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>

          {hasConflict ? (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 p-4 rounded-xl flex items-start gap-3 animate-pulse">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                  <div>
                      <h4 className="font-bold">Disagreement Detected!</h4>
                      <p className="text-sm mt-1">Discuss with your team. You must all agree on one answer to submit.</p>
                  </div>
              </div>
          ) : consensusReached ? (
              <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 p-4 rounded-xl flex items-center gap-3">
                  <ThumbsUp className="w-6 h-6 flex-shrink-0" />
                  <div>
                      <h4 className="font-bold">Consensus Reached!</h4>
                      <p className="text-sm mt-1">Everyone agrees. Ready to submit.</p>
                  </div>
              </div>
          ) : (
              <div className="text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  Waiting for teammates to vote...
              </div>
          )}

          <div className="flex gap-3">
              <button 
                  onClick={() => setIsVoting(false)}
                  className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-300 transition-colors"
              >
                  Change My Vote
              </button>
              {consensusReached && (
                  <button 
                      onClick={handleFinalize}
                      className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                      <CheckCircle className="w-5 h-5" /> Submit Final
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
                    ? (isEditMode ? 'Editor View' : 'Instructor View')
                    : (point.isUnlocked ? 'You are at the location!' : `Distance: ${Math.round(distance)}m`)}
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
                <div className="mb-6 bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800 rounded-lg p-3">
                  <span className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider">Solution</span>
                  <p className="text-orange-900 dark:text-orange-200 font-medium">
                      {point.task.type === 'slider' 
                        ? point.task.range?.correctValue 
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
                        {isInstructor ? 'Verify Answer' : 'Submit to Team'}
                    </button>
                    </form>
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
