import React, { useState, useEffect } from 'react';
import { GamePoint, TaskVote } from '../types';
import { X, CheckCircle, Lock, MapPin, Glasses, AlertCircle, ChevronDown, ChevronsUpDown, Users, AlertTriangle, Loader2, ThumbsUp } from 'lucide-react';
import { teamSync } from '../services/teamSync';

interface TaskModalProps {
  point: GamePoint | null;
  onClose: () => void;
  onComplete: (pointId: string, answer?: string) => void;
  onUnlock?: (pointId: string) => void;
  distance: number;
  isInstructorMode?: boolean;
}

const TaskModal: React.FC<TaskModalProps> = ({ point, onClose, onComplete, onUnlock, distance, isInstructorMode = false }) => {
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

  // Subscribe to Realtime Updates
  useEffect(() => {
      if (!point) return;
      
      const unsubscribeVotes = teamSync.subscribeToVotes((votes) => {
          setTeamVotes(votes);
      });
      
      const unsubscribeMembers = teamSync.subscribeToMemberCount((count) => {
          // Add self (1) if count is just others, typically broadcast gives total listeners
          // We'll estimate based on unique vote IDs + 1 if needed, but simplistic approach:
          setMemberCount(Math.max(teamSync.getVotesForTask(point.id).length, 1)); 
      });

      // Load existing votes if any
      const existing = teamSync.getVotesForTask(point.id);
      if (existing.length > 0) {
          setTeamVotes(existing);
          // If we have voted, enter voting mode
          const myId = teamSync.getDeviceId();
          const myVote = existing.find(v => v.deviceId === myId);
          if (myVote) {
              setIsVoting(true);
              // Restore answer state potentially? Not strictly necessary for MVP flow
          }
      }

      return () => {
          unsubscribeVotes();
          unsubscribeMembers();
      };
  }, [point]);

  if (!point) return null;

  const isLocked = !point.isUnlocked && !isInstructorMode;

  // --- Logic for Agreement ---
  const checkConsensus = () => {
      if (teamVotes.length === 0) return false;
      const firstAnswer = JSON.stringify(teamVotes[0].answer);
      return teamVotes.every(v => JSON.stringify(v.answer) === firstAnswer);
  };

  const consensusReached = checkConsensus();
  const hasConflict = teamVotes.length > 1 && !consensusReached;
  const myDeviceId = teamSync.getDeviceId();
  const hasEveryoneVoted = teamVotes.length >= memberCount && memberCount > 1; // Simplistic logic

  const handleSubmitVote = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let finalAnswer: any = answer;
    if (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') {
        finalAnswer = selectedOptions;
    } else if (point.task.type === 'slider') {
        finalAnswer = sliderValue;
    }

    // Instead of completing locally immediately, we cast a vote
    teamSync.castVote(point.id, finalAnswer);
    setIsVoting(true);
  };

  const handleFinalize = () => {
      // Logic for checking correctness (Instructor or Auto)
      // We assume if consensus is reached, we check that SINGLE agreed answer against the correct one
      const agreedAnswer = teamVotes[0].answer;
      let isCorrect = false;

      // Validation Logic (Reused)
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

      if (isCorrect || isInstructorMode) {
          onComplete(point.id, isInstructorMode ? "Verified by Instructor" : "Correct");
          onClose();
      } else {
          setErrorMsg("Team answer is incorrect. Try again!");
          setIsVoting(false); // Reset to allow re-voting
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
                    autoFocus={!isInstructorMode}
                />
              );
      }
  };

  const renderConsensusView = () => (
      <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" /> Team Votes
                  </h3>
                  <div className="text-xs font-bold px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                      {teamVotes.length} Voted
                  </div>
              </div>
              
              <div className="space-y-2">
                  {teamVotes.map((vote, i) => {
                      const isMe = vote.deviceId === myDeviceId;
                      return (
                          <div key={i} className={`flex justify-between items-center p-3 rounded-lg ${isMe ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800' : 'bg-white dark:bg-gray-700'}`}>
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                  {isMe ? "You" : `Teammate ${i+1}`}
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                                  {Array.isArray(vote.answer) ? vote.answer.join(', ') : vote.answer}
                              </span>
                          </div>
                      )
                  })}
              </div>
          </div>

          {hasConflict ? (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 p-4 rounded-xl flex items-start gap-3 animate-pulse">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                  <div>
                      <h4 className="font-bold">Disagreement Detected!</h4>
                      <p className="text-sm mt-1">Are you sure? Your teammates think something else. Discuss and agree on a single answer.</p>
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
                  Change Vote
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`p-6 ${point.isCompleted ? 'bg-green-100 dark:bg-green-900/30' : (!isLocked ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-800')}`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {point.isCompleted ? (
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-500" />
              ) : !isLocked ? (
                isInstructorMode ? <Glasses className="w-8 h-8 text-orange-600 dark:text-orange-400" /> : <MapPin className="w-8 h-8 text-orange-600 dark:text-orange-500" />
              ) : (
                <Lock className="w-8 h-8 text-red-500 dark:text-red-400" />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{point.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {isInstructorMode 
                    ? 'Instructor View (Unlocked)' 
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
              <div className="prose prose-sm mb-6 dark:prose-invert">
                <p className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed font-medium">{point.task.question}</p>
                
                {point.task.imageUrl ? (
                  <div className="mt-4 rounded-lg overflow-hidden shadow-sm">
                    <img src={point.task.imageUrl} alt="Task" className="w-full h-auto object-cover max-h-60" />
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg bg-gray-100 dark:bg-gray-800 h-32 w-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                    {/* No image placeholder */}
                  </div>
                )}
              </div>

              {isInstructorMode && (
                <div className="mb-6 bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800 rounded-lg p-3">
                  <span className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider">Solution</span>
                  <p className="text-orange-900 dark:text-orange-200 font-medium">
                      {point.task.type === 'slider' 
                        ? point.task.range?.correctValue 
                        : (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown' ? point.task.correctAnswers?.join(', ') : point.task.answer)}
                  </p>
                </div>
              )}

              {!point.isCompleted ? (
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
                        {isInstructorMode ? 'Verify Answer' : 'Submit to Team'}
                    </button>
                    </form>
                )
              ) : (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                  <p className="text-green-800 dark:text-green-300 font-medium">Task Completed!</p>
                  <p className="text-sm text-green-600 dark:text-green-400">You earned 100 points.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;