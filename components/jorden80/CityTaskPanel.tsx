/**
 * CityTaskPanel - Shows the 3 tasks for the current city
 * Displays by-opgave, land-opgave, and kreativ opgave with completion status
 */

import React from 'react';
import { GamePoint, Jorden80City, Jorden80CityProgress, Jorden80TaskType } from '../../types';
import { countCorrectAnswersInCity, isCityCompleted } from '../../utils/jorden80/dayCalculation';
import { Building2, Globe2, Paintbrush, Check, X, Clock, Lock, ArrowRight } from 'lucide-react';

interface CityTaskPanelProps {
  city: Jorden80City;
  tasks: GamePoint[];
  cityProgress: Jorden80CityProgress | undefined;
  onSelectTask: (task: GamePoint) => void;
  onChooseDestination: () => void;
  isInstructor?: boolean;
}

const CityTaskPanel: React.FC<CityTaskPanelProps> = ({
  city,
  tasks,
  cityProgress,
  onSelectTask,
  onChooseDestination,
  isInstructor = false
}) => {
  // Categorize tasks by type
  const byTask = tasks.find(t => t.jorden80TaskType === 'by');
  const landTask = tasks.find(t => t.jorden80TaskType === 'land');
  const creativeTask = tasks.find(t => t.jorden80TaskType === 'creative');

  const progress = cityProgress || {
    byTask: { completed: false, correct: false, points: 0 },
    landTask: { completed: false, correct: false, points: 0 },
    creativeTask: { completed: false, score: 0, approved: false }
  };

  const correctCount = countCorrectAnswersInCity(progress);
  const allCompleted = isCityCompleted(progress);

  const getTaskIcon = (type: Jorden80TaskType) => {
    switch (type) {
      case 'by':
        return Building2;
      case 'land':
        return Globe2;
      case 'creative':
        return Paintbrush;
    }
  };

  const getTaskLabel = (type: Jorden80TaskType) => {
    switch (type) {
      case 'by':
        return 'By-opgave';
      case 'land':
        return 'Land-opgave';
      case 'creative':
        return 'Kreativ opgave';
    }
  };

  const getTaskProgress = (type: Jorden80TaskType) => {
    switch (type) {
      case 'by':
        return progress.byTask;
      case 'land':
        return progress.landTask;
      case 'creative':
        return {
          completed: progress.creativeTask.completed,
          correct: progress.creativeTask.approved && progress.creativeTask.score > 0,
          points: progress.creativeTask.score,
          needsApproval: progress.creativeTask.completed && !progress.creativeTask.approved
        };
    }
  };

  const renderTaskItem = (task: GamePoint | undefined, type: Jorden80TaskType) => {
    const Icon = getTaskIcon(type);
    const label = getTaskLabel(type);
    const taskProgress = getTaskProgress(type);

    if (!task) {
      return (
        <div className="j80-task-item opacity-50">
          <div className="j80-task-icon">
            <Icon className="w-5 h-5" style={{ color: 'var(--j80-sepia)' }} />
          </div>
          <div className="flex-1">
            <div className="j80-font-heading" style={{ color: 'var(--j80-ink-brown)' }}>
              {label}
            </div>
            <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
              Ingen opgave tilgængelig
            </div>
          </div>
        </div>
      );
    }

    const isCompleted = taskProgress.completed;
    const isCorrect = taskProgress.correct;
    const needsApproval = type === 'creative' && taskProgress.completed && !progress.creativeTask.approved;

    return (
      <button
        onClick={() => !isCompleted && onSelectTask(task)}
        disabled={isCompleted && !isInstructor}
        className={`j80-task-item w-full text-left ${
          isCompleted ? 'cursor-default' : 'hover:bg-[var(--j80-parchment)] cursor-pointer'
        }`}
      >
        <div
          className={`j80-task-icon ${
            isCompleted
              ? isCorrect
                ? 'completed'
                : needsApproval
                ? ''
                : 'incorrect'
              : ''
          }`}
          style={
            needsApproval
              ? { backgroundColor: 'var(--j80-warning)', borderColor: 'var(--j80-warning)', color: 'white' }
              : undefined
          }
        >
          {isCompleted ? (
            needsApproval ? (
              <Clock className="w-5 h-5" />
            ) : isCorrect ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )
          ) : (
            <Icon className="w-5 h-5" style={{ color: 'var(--j80-sepia)' }} />
          )}
        </div>

        <div className="flex-1">
          <div className="j80-font-heading" style={{ color: 'var(--j80-ink-brown)' }}>
            {label}
          </div>
          <div className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
            {task.title}
          </div>

          {isCompleted && (
            <div
              className="j80-font-body text-sm mt-1"
              style={{
                color: needsApproval
                  ? 'var(--j80-warning)'
                  : isCorrect
                  ? 'var(--j80-success)'
                  : 'var(--j80-error)'
              }}
            >
              {needsApproval
                ? 'Afventer godkendelse'
                : isCorrect
                ? `+${taskProgress.points} point`
                : 'Forkert svar'}
            </div>
          )}
        </div>

        {!isCompleted && (
          <div
            className="px-3 py-1 rounded-full text-sm j80-font-heading"
            style={{ backgroundColor: 'var(--j80-gold)', color: 'var(--j80-ink-black)' }}
          >
            {task.points} pt
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="j80-task-panel">
      {/* Header */}
      <div className="j80-task-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{city.flagEmoji}</span>
            <div>
              <h2 className="j80-font-heading text-xl">{city.name}</h2>
              <p className="j80-font-body text-sm opacity-80">{city.country}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="j80-font-body text-sm opacity-80">Korrekte</div>
            <div className="j80-font-heading text-2xl">{correctCount}/3</div>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div>
        {renderTaskItem(byTask, 'by')}
        {renderTaskItem(landTask, 'land')}
        {renderTaskItem(creativeTask, 'creative')}
      </div>

      {/* Continue Button (when all completed) */}
      {allCompleted && city.tier < 5 && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--j80-sepia-light)' }}>
          <button
            onClick={onChooseDestination}
            className="w-full j80-btn j80-btn-primary flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-5 h-5" />
            Vælg Næste Destination
          </button>

          <p className="j80-font-body text-sm text-center mt-2" style={{ color: 'var(--j80-sepia)' }}>
            {correctCount === 3
              ? 'Perfekt! Vælg mellem alle 3 ruter.'
              : correctCount === 2
              ? 'Godt klaret! Vælg mellem 2 ruter.'
              : 'Du kan kun vælge 1 rute.'}
          </p>
        </div>
      )}

      {/* Goal reached (Istanbul) */}
      {city.tier === 5 && allCompleted && (
        <div
          className="p-6 text-center"
          style={{ backgroundColor: 'var(--j80-gold)', color: 'var(--j80-ink-black)' }}
        >
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="j80-font-heading text-xl">Tillykke!</h3>
          <p className="j80-font-body">
            I har gennemført rejsen til Istanbul!
          </p>
        </div>
      )}

      {/* Not completed message */}
      {!allCompleted && (
        <div className="p-4 text-center" style={{ borderTop: '1px solid var(--j80-sepia-light)' }}>
          <p className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
            {3 - (progress.byTask.completed ? 1 : 0) - (progress.landTask.completed ? 1 : 0) - (progress.creativeTask.completed ? 1 : 0)} opgaver tilbage
          </p>
        </div>
      )}
    </div>
  );
};

export default CityTaskPanel;
