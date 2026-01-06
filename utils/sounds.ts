// Common Sound Library
export interface SoundOption {
  id: string;
  name: string;
  url: string;
  description: string;
}

// Free sound effects from various sources (royalty-free)
export const CORRECT_SOUNDS: SoundOption[] = [
  {
    id: 'none',
    name: 'No Sound',
    url: '',
    description: 'Silent - no sound plays'
  },
  {
    id: 'correct_1',
    name: 'Success Chime',
    url: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
    description: 'Classic success sound'
  },
  {
    id: 'correct_2',
    name: 'Level Up',
    url: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
    description: 'Game level-up sound'
  },
  {
    id: 'correct_3',
    name: 'Coin Collect',
    url: 'https://assets.mixkit.co/active_storage/sfx/1999/1999-preview.mp3',
    description: 'Coin collection sound'
  },
  {
    id: 'correct_4',
    name: 'Achievement',
    url: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
    description: 'Achievement unlocked'
  },
  {
    id: 'correct_5',
    name: 'Bell Ding',
    url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    description: 'Simple bell ding'
  },
];

export const INCORRECT_SOUNDS: SoundOption[] = [
  {
    id: 'none',
    name: 'No Sound',
    url: '',
    description: 'Silent - no sound plays'
  },
  {
    id: 'incorrect_1',
    name: 'Error Buzz',
    url: 'https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3',
    description: 'Classic error buzz'
  },
  {
    id: 'incorrect_2',
    name: 'Wrong Answer',
    url: 'https://assets.mixkit.co/active_storage/sfx/1993/1993-preview.mp3',
    description: 'Game wrong answer'
  },
  {
    id: 'incorrect_3',
    name: 'Fail Horn',
    url: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
    description: 'Sad trombone'
  },
  {
    id: 'incorrect_4',
    name: 'Denied',
    url: 'https://assets.mixkit.co/active_storage/sfx/2954/2954-preview.mp3',
    description: 'Access denied beep'
  },
  {
    id: 'incorrect_5',
    name: 'Error Alert',
    url: 'https://assets.mixkit.co/active_storage/sfx/1994/1994-preview.mp3',
    description: 'Alert error sound'
  },
];

// Global default sounds (stored in localStorage)
const STORAGE_KEY_CORRECT = 'tb_global_correct_sound';
const STORAGE_KEY_INCORRECT = 'tb_global_incorrect_sound';
const STORAGE_KEY_VOLUME = 'tb_global_volume';

export const getGlobalCorrectSound = (): string => {
  return localStorage.getItem(STORAGE_KEY_CORRECT) || CORRECT_SOUNDS[0].url;
};

export const getGlobalIncorrectSound = (): string => {
  return localStorage.getItem(STORAGE_KEY_INCORRECT) || INCORRECT_SOUNDS[0].url;
};

export const getGlobalVolume = (): number => {
  const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
  return stored ? parseInt(stored) : 80;
};

export const setGlobalCorrectSound = (url: string) => {
  localStorage.setItem(STORAGE_KEY_CORRECT, url);
};

export const setGlobalIncorrectSound = (url: string) => {
  localStorage.setItem(STORAGE_KEY_INCORRECT, url);
};

export const setGlobalVolume = (volume: number) => {
  localStorage.setItem(STORAGE_KEY_VOLUME, volume.toString());
};

// Play sound with volume control
export const playSound = (url: string, volume: number = 80) => {
  // If URL is empty (No Sound option), don't play anything
  if (!url || url.trim() === '') {
    return;
  }

  const audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume / 100)); // Clamp between 0 and 1
  audio.play().catch(err => console.warn('Sound playback failed:', err));
};
