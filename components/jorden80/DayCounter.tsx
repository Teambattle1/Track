/**
 * DayCounter - Widget showing current day and remaining days
 * Victorian-styled day tracker for the 80 Days journey
 */

import React from 'react';
import { Jorden80Config, Jorden80TeamProgress } from '../../types';
import { getRemainingDays, DEFAULT_JORDEN80_CONFIG } from '../../utils/jorden80/dayCalculation';
import { Clock } from 'lucide-react';

interface DayCounterProps {
  progress: Jorden80TeamProgress;
  config?: Jorden80Config;
  compact?: boolean;
}

const DayCounter: React.FC<DayCounterProps> = ({
  progress,
  config = DEFAULT_JORDEN80_CONFIG,
  compact = false
}) => {
  const remaining = getRemainingDays(progress, config);
  const isOverLimit = progress.daysUsed > config.daysLimit;
  const isNearLimit = remaining <= 10 && remaining > 0;

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          backgroundColor: isOverLimit
            ? 'var(--j80-error)'
            : isNearLimit
            ? 'var(--j80-warning)'
            : 'var(--j80-parchment-dark)',
          color: isOverLimit || isNearLimit ? 'white' : 'var(--j80-ink-brown)'
        }}
      >
        <Clock className="w-4 h-4" />
        <span className="j80-font-heading text-sm">
          Dag {progress.daysUsed}
        </span>
      </div>
    );
  }

  return (
    <div className="j80-day-counter">
      <div className="day-label">Rejsedag</div>
      <div
        className="day-value"
        style={{
          color: isOverLimit
            ? 'var(--j80-error)'
            : isNearLimit
            ? 'var(--j80-warning)'
            : 'var(--j80-ink-brown)'
        }}
      >
        {progress.daysUsed}
      </div>
      <div className="day-remaining">
        {isOverLimit ? (
          <span style={{ color: 'var(--j80-error)' }}>
            {Math.abs(remaining)} dage over!
          </span>
        ) : (
          <>
            {remaining} dage tilbage af {config.daysLimit}
          </>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="mt-3 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--j80-sepia-light)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, (progress.daysUsed / config.daysLimit) * 100)}%`,
            backgroundColor: isOverLimit
              ? 'var(--j80-error)'
              : isNearLimit
              ? 'var(--j80-warning)'
              : 'var(--j80-gold)'
          }}
        />
      </div>
    </div>
  );
};

export default DayCounter;
