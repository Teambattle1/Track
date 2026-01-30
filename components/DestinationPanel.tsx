import React, { useState } from 'react';
import { Destination, GamePoint, TeamDestinationProgress } from '../types';
import {
  X, Flag, MapPin, Lock, CheckCircle, Star, ChevronRight,
  Camera, Video, HelpCircle, Compass, Trophy, Clock
} from 'lucide-react';

interface DestinationPanelProps {
  destination: Destination;
  tasks: GamePoint[];
  progress: TeamDestinationProgress | null;
  isUnlocked: boolean;
  isCompleted: boolean;
  isFirstArrival: boolean;
  onClose: () => void;
  onTaskSelect: (task: GamePoint) => void;
  firstArrivalBonus?: number;
}

/**
 * DestinationPanel - Slide-up panel showing destination info and tasks
 * Displays country info, flag, tasks list, and progress
 */
const DestinationPanel: React.FC<DestinationPanelProps> = ({
  destination,
  tasks,
  progress,
  isUnlocked,
  isCompleted,
  isFirstArrival,
  onClose,
  onTaskSelect,
  firstArrivalBonus = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate progress
  const completedTasks = progress?.completedTasks || [];
  const progressPercent = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  // Get task icon based on type
  const getTaskIcon = (task: GamePoint) => {
    if (task.isFieldMission) return Compass;
    switch (task.task.type) {
      case 'photo': return Camera;
      case 'video': return Video;
      case 'multiple_choice':
      case 'boolean':
      case 'text':
      default: return HelpCircle;
    }
  };

  // Check if task is completed
  const isTaskCompleted = (taskId: string) => completedTasks.includes(taskId);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[4000] animate-in slide-in-from-bottom duration-300">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`bg-slate-900 border-t-2 border-slate-700 rounded-t-3xl shadow-2xl transition-all duration-300 ${
        isExpanded ? 'max-h-[85vh]' : 'max-h-[50vh]'
      } overflow-hidden flex flex-col`}>

        {/* Drag Handle */}
        <div
          className="py-2 flex justify-center cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-12 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-slate-700/50">
          <div className="flex items-start justify-between">
            {/* Destination Info */}
            <div className="flex items-center gap-4">
              {/* Flag */}
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg ${
                  isCompleted
                    ? 'bg-gradient-to-br from-green-600 to-emerald-700 border-2 border-green-400'
                    : isUnlocked
                      ? 'bg-gradient-to-br from-cyan-600 to-blue-700 border-2 border-cyan-400'
                      : 'bg-slate-800 border-2 border-slate-600'
                }`}
                style={destination.color ? { backgroundColor: `${destination.color}20`, borderColor: destination.color } : undefined}
              >
                {destination.flagEmoji || <Flag className="w-8 h-8 text-white" />}
              </div>

              {/* Name and Status */}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">
                    {destination.name}
                  </h2>
                  {isCompleted && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                  {!isUnlocked && (
                    <Lock className="w-5 h-5 text-slate-500" />
                  )}
                </div>

                {/* Country Code */}
                {destination.countryCode && (
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {destination.countryCode}
                  </div>
                )}

                {/* First Arrival Badge */}
                {isFirstArrival && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-[10px] font-black text-yellow-400 uppercase tracking-wide">
                      First Arrival! +{firstArrivalBonus} pts
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Description */}
          {destination.description && (
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              {destination.description}
            </p>
          )}

          {/* Progress Bar */}
          {isUnlocked && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                <span className="text-slate-400 font-bold">Progress</span>
                <span className={`font-black ${isCompleted ? 'text-green-400' : 'text-cyan-400'}`}>
                  {completedTasks.length}/{tasks.length} Tasks
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isCompleted
                      ? 'bg-gradient-to-r from-green-600 to-emerald-400'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tasks List */}
        <div className="flex-1 overflow-y-auto">
          {!isUnlocked ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                Destination Locked
              </h3>
              <p className="text-xs text-slate-500">
                Complete previous destinations to unlock this one
              </p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center">
              <MapPin className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <p className="text-xs text-slate-400">No tasks at this destination</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {tasks.map((task, index) => {
                const TaskIcon = getTaskIcon(task);
                const completed = isTaskCompleted(task.id);

                return (
                  <button
                    key={task.id}
                    onClick={() => !completed && onTaskSelect(task)}
                    disabled={completed}
                    className={`w-full p-4 flex items-center gap-4 text-left transition-colors ${
                      completed
                        ? 'bg-green-900/10 opacity-60'
                        : 'hover:bg-slate-800/50 active:bg-slate-800'
                    }`}
                  >
                    {/* Task Number/Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      completed
                        ? 'bg-green-600/30 border-2 border-green-500'
                        : task.isFieldMission
                          ? 'bg-orange-600/30 border-2 border-orange-500'
                          : 'bg-slate-700 border-2 border-slate-600'
                    }`}>
                      {completed ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <TaskIcon className={`w-5 h-5 ${
                          task.isFieldMission ? 'text-orange-400' : 'text-slate-300'
                        }`} />
                      )}
                    </div>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          completed ? 'text-green-400 line-through' : 'text-white'
                        }`}>
                          {task.title || `Task ${index + 1}`}
                        </span>
                        {task.isFieldMission && !completed && (
                          <span className="text-[8px] bg-orange-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase">
                            GPS
                          </span>
                        )}
                      </div>

                      {/* Task Type */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                          {task.task.type === 'photo' ? 'Photo' :
                           task.task.type === 'video' ? 'Video' :
                           task.task.type === 'multiple_choice' ? 'Quiz' :
                           task.task.type === 'boolean' ? 'True/False' :
                           'Question'}
                        </span>
                        {task.points > 0 && (
                          <>
                            <span className="text-slate-700">•</span>
                            <span className="text-[10px] text-cyan-400 font-bold">
                              {task.points} pts
                            </span>
                          </>
                        )}
                      </div>

                      {/* Field Mission Hint */}
                      {task.isFieldMission && task.fieldMissionHint && !completed && (
                        <div className="mt-1.5 text-[10px] text-orange-400/70 italic">
                          {task.fieldMissionHint}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    {!completed && (
                      <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {isUnlocked && !isCompleted && tasks.length > 0 && (
          <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>
                Complete all {tasks.length} task{tasks.length > 1 ? 's' : ''} to unlock the next destination
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DestinationPanel;
