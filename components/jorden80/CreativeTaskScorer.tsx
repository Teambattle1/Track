/**
 * CreativeTaskScorer - Instructor interface for scoring creative tasks
 * Allows partial scoring from 0-150 points for creative submissions
 */

import React, { useState } from 'react';
import { GamePoint, Team, Jorden80TeamProgress, Jorden80CityProgress, Game } from '../../types';
import { Check, X, Paintbrush } from 'lucide-react';

interface CreativeTaskScorerProps {
  task: GamePoint;
  team: Team;
  progress: Jorden80TeamProgress;
  cityId: string;
  mediaUrl?: string;
  onApprove: (score: number) => void;
  onReject: () => void;
  onClose: () => void;
}

const CreativeTaskScorer: React.FC<CreativeTaskScorerProps> = ({
  task,
  team,
  progress,
  cityId,
  mediaUrl,
  onApprove,
  onReject,
  onClose
}) => {
  const [score, setScore] = useState(100);
  const maxScore = task.points || 150;

  const cityProgress = progress.cityProgress[cityId];
  const creativeTask = cityProgress?.creativeTask;

  // Already approved
  if (creativeTask?.approved) {
    return (
      <div className="j80-scorer">
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="j80-font-heading text-lg" style={{ color: 'var(--j80-ink-brown)' }}>
            Allerede godkendt
          </h3>
          <p className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
            Score: {creativeTask.score} point
          </p>
          <button onClick={onClose} className="j80-btn j80-btn-secondary mt-4">
            Luk
          </button>
        </div>
      </div>
    );
  }

  // Not submitted yet
  if (!creativeTask?.completed) {
    return (
      <div className="j80-scorer">
        <div className="text-center">
          <div className="text-4xl mb-2">⏳</div>
          <h3 className="j80-font-heading text-lg" style={{ color: 'var(--j80-ink-brown)' }}>
            Ikke afleveret endnu
          </h3>
          <p className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
            Holdet har ikke afleveret denne opgave.
          </p>
          <button onClick={onClose} className="j80-btn j80-btn-secondary mt-4">
            Luk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="j80-scorer">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: team.color || 'var(--j80-sepia)', color: 'white' }}
        >
          <Paintbrush className="w-6 h-6" />
        </div>
        <div>
          <h3 className="j80-font-heading text-lg" style={{ color: 'var(--j80-ink-brown)' }}>
            {team.name}
          </h3>
          <p className="j80-font-body text-sm" style={{ color: 'var(--j80-sepia)' }}>
            {task.title}
          </p>
        </div>
      </div>

      {/* Media Preview */}
      {mediaUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border-2" style={{ borderColor: 'var(--j80-sepia)' }}>
          <img
            src={mediaUrl}
            alt="Submission"
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Score Slider */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <label className="j80-font-body" style={{ color: 'var(--j80-sepia)' }}>
            Score
          </label>
          <span
            className="j80-font-heading text-xl"
            style={{ color: 'var(--j80-gold)' }}
          >
            {score} / {maxScore}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => setScore(parseInt(e.target.value))}
          className="j80-score-slider w-full"
        />

        {/* Quick score buttons */}
        <div className="flex gap-2 mt-3">
          {[0, 50, 100, maxScore].map((val) => (
            <button
              key={val}
              onClick={() => setScore(val)}
              className={`flex-1 px-2 py-1 rounded text-sm j80-font-body transition-colors ${
                score === val
                  ? 'bg-[var(--j80-gold)] text-[var(--j80-ink-black)]'
                  : 'bg-[var(--j80-parchment-dark)] text-[var(--j80-ink-brown)] hover:bg-[var(--j80-gold-light)]'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 j80-btn flex items-center justify-center gap-2"
          style={{
            backgroundColor: 'var(--j80-error)',
            color: 'white',
            borderColor: 'var(--j80-error)'
          }}
        >
          <X className="w-5 h-5" />
          Afvis
        </button>
        <button
          onClick={() => onApprove(score)}
          className="flex-1 j80-btn j80-btn-primary flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Godkend
        </button>
      </div>

      <p className="j80-font-body text-sm text-center mt-3" style={{ color: 'var(--j80-sepia)' }}>
        Afvisning tæller som 0 point men opgaven markeres som gennemført.
      </p>
    </div>
  );
};

export default CreativeTaskScorer;
