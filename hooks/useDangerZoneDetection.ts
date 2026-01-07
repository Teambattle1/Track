import { useState, useEffect, useRef } from 'react';
import { DangerZone, Coordinate } from '../types';
import { haversineMeters } from '../utils/geo';

interface DangerZoneState {
  currentZone: DangerZone | null;
  enteredTime: number | null;
  totalDeducted: number;
  elapsedSeconds: number;
  scoreDeductedPerSecond: number;
}

export const useDangerZoneDetection = (
  userLocation: Coordinate | null | undefined,
  dangerZones: DangerZone[] = [],
  currentScore: number,
  onScoreChange: (newScore: number) => void
) => {
  const [dangerZoneState, setDangerZoneState] = useState<DangerZoneState>({
    currentZone: null,
    enteredTime: null,
    totalDeducted: 0,
    elapsedSeconds: 0,
    scoreDeductedPerSecond: 0,
  });

  const scoreRef = useRef(currentScore);
  const deductionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update score ref
  useEffect(() => {
    scoreRef.current = currentScore;
  }, [currentScore]);

  // Detection and penalty logic
  useEffect(() => {
    if (!userLocation) {
      // Clear state if no location
      setDangerZoneState({
        currentZone: null,
        enteredTime: null,
        totalDeducted: 0,
        elapsedSeconds: 0,
        scoreDeductedPerSecond: 0,
      });
      return;
    }

    // Check danger zones every 500ms
    const checkInterval = setInterval(() => {
      // Find which danger zone player is in (if any)
      let currentZone: DangerZone | null = null;
      let minDistance = Infinity;

      for (const zone of dangerZones) {
        const distance = haversineMeters(userLocation, zone.location);
        if (distance <= zone.radius && distance < minDistance) {
          currentZone = zone;
          minDistance = distance;
        }
      }

      setDangerZoneState(prev => {
        // No longer in any danger zone
        if (!currentZone) {
          if (prev.currentZone) {
            // Just exited danger zone - clear deduction interval
            if (deductionIntervalRef.current) {
              clearInterval(deductionIntervalRef.current);
              deductionIntervalRef.current = null;
            }
          }
          return {
            currentZone: null,
            enteredTime: null,
            totalDeducted: 0,
            elapsedSeconds: 0,
            scoreDeductedPerSecond: 0,
          };
        }

        // Just entered a new danger zone
        if (!prev.currentZone || prev.currentZone.id !== currentZone.id) {
          return {
            currentZone,
            enteredTime: Date.now(),
            totalDeducted: 0,
            elapsedSeconds: 0,
            scoreDeductedPerSecond: currentZone.penaltyType === 'time_based' ? currentZone.penalty : 0,
          };
        }

        // Already in danger zone - update elapsed time
        const now = Date.now();
        const enteredTime = prev.enteredTime!;
        const elapsedSeconds = Math.floor((now - enteredTime) / 1000);

        return {
          ...prev,
          elapsedSeconds,
        };
      });
    }, 500);

    return () => clearInterval(checkInterval);
  }, [userLocation, dangerZones]);

  // Handle time-based score deduction
  useEffect(() => {
    if (!dangerZoneState.currentZone || dangerZoneState.currentZone.penaltyType !== 'time_based') {
      if (deductionIntervalRef.current) {
        clearInterval(deductionIntervalRef.current);
        deductionIntervalRef.current = null;
      }
      return;
    }

    const zone = dangerZoneState.currentZone;
    const graceEndTime = dangerZoneState.enteredTime! + zone.duration * 1000;

    // Only start deducting after grace period ends
    if (Date.now() < graceEndTime) {
      if (deductionIntervalRef.current) {
        clearInterval(deductionIntervalRef.current);
        deductionIntervalRef.current = null;
      }
      return;
    }

    // Deduct points every second
    deductionIntervalRef.current = setInterval(() => {
      setDangerZoneState(prev => {
        const newDeducted = prev.totalDeducted + zone.penalty;
        const newScore = scoreRef.current - zone.penalty;
        scoreRef.current = Math.max(0, newScore); // Prevent negative scores
        onScoreChange(scoreRef.current);

        return {
          ...prev,
          totalDeducted: newDeducted,
        };
      });
    }, 1000);

    return () => {
      if (deductionIntervalRef.current) {
        clearInterval(deductionIntervalRef.current);
        deductionIntervalRef.current = null;
      }
    };
  }, [dangerZoneState.currentZone, dangerZoneState.enteredTime, onScoreChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deductionIntervalRef.current) clearInterval(deductionIntervalRef.current);
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, []);

  return dangerZoneState;
};
