import React from 'react';

// Map icon - solid map with location pin
export const MapModeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);

// Playzone icon - dotted circle/zone
export const PlayzoneModeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    strokeDasharray="2 3"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

// Elimination icon - flag
export const EliminationModeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

// Around the World icon - globe with path
export const AroundTheWorldModeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    <path d="M2 12h20" />
  </svg>
);

// Jorden 80 icon - Compass for Victorian journey theme
export const Jorden80ModeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
  </svg>
);

// Get icon and color based on game mode
export const getGameModeIcon = (gameMode?: 'standard' | 'map' | 'playzone' | 'elimination' | 'aroundtheworld') => {
  switch (gameMode) {
    case 'playzone':
      return {
        Icon: PlayzoneModeIcon,
        label: 'PLAYZONE',
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        borderColor: 'border-purple-300 dark:border-purple-700'
      };
    case 'elimination':
      return {
        Icon: EliminationModeIcon,
        label: 'ELIMINATION',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        borderColor: 'border-red-300 dark:border-red-700'
      };
    case 'aroundtheworld':
      return {
        Icon: AroundTheWorldModeIcon,
        label: 'AROUND THE WORLD',
        color: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
        borderColor: 'border-cyan-300 dark:border-cyan-700'
      };
    case 'standard':
    case 'map':
    default:
      return {
        Icon: MapModeIcon,
        label: 'MAP',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        borderColor: 'border-blue-300 dark:border-blue-700'
      };
  }
};
