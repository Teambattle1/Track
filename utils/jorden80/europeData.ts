/**
 * Europe data for Jorden 80 Dage (80 Days) game mode
 * All 12 cities with positions, flags, and tier information
 */

import { Jorden80City } from '../../types';

// All 12 European cities for the 80 Days route
// Positions calibrated for vintage 1898 Europe map background
export const JORDEN80_CITIES: Jorden80City[] = [
  {
    id: 'london',
    name: 'London',
    country: 'England',
    tier: 0, // Start
    position: { x: 175, y: 185 },
    flagEmoji: '🇬🇧',
    connections: {
      3: ['amsterdam', 'paris', 'bruxelles'],
      2: ['paris', 'bruxelles'],
      1: ['bruxelles'],
      0: ['bruxelles']
    }
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Holland',
    tier: 1,
    position: { x: 265, y: 175 },
    flagEmoji: '🇳🇱',
    connections: {
      3: ['berlin', 'prag', 'wien'],
      2: ['berlin', 'koln'],
      1: ['koln'],
      0: ['koln']
    }
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'Frankrig',
    tier: 1,
    position: { x: 220, y: 255 },
    flagEmoji: '🇫🇷',
    connections: {
      3: ['lyon', 'milano', 'berlin'],
      2: ['lyon', 'koln'],
      1: ['lyon'],
      0: ['lyon']
    }
  },
  {
    id: 'bruxelles',
    name: 'Bruxelles',
    country: 'Belgien',
    tier: 1,
    position: { x: 250, y: 210 },
    flagEmoji: '🇧🇪',
    connections: {
      3: ['amsterdam', 'paris', 'koln'],
      2: ['paris', 'koln'],
      1: ['koln'],
      0: ['koln']
    }
  },
  {
    id: 'berlin',
    name: 'Berlin',
    country: 'Tyskland',
    tier: 2,
    position: { x: 370, y: 175 },
    flagEmoji: '🇩🇪',
    connections: {
      3: ['prag', 'wien', 'budapest'],
      2: ['prag', 'wien'],
      1: ['prag'],
      0: ['prag']
    }
  },
  {
    id: 'lyon',
    name: 'Lyon',
    country: 'Frankrig',
    tier: 2,
    position: { x: 245, y: 315 },
    flagEmoji: '🇫🇷',
    connections: {
      3: ['milano', 'wien', 'budapest'],
      2: ['milano', 'wien'],
      1: ['milano'],
      0: ['milano']
    }
  },
  {
    id: 'koln',
    name: 'Köln',
    country: 'Tyskland',
    tier: 2,
    position: { x: 295, y: 210 },
    flagEmoji: '🇩🇪',
    connections: {
      3: ['berlin', 'prag', 'wien'],
      2: ['berlin', 'prag'],
      1: ['berlin'],
      0: ['berlin']
    }
  },
  {
    id: 'milano',
    name: 'Milano',
    country: 'Italien',
    tier: 3,
    position: { x: 310, y: 330 },
    flagEmoji: '🇮🇹',
    connections: {
      3: ['wien', 'budapest', 'istanbul'],
      2: ['wien', 'budapest'],
      1: ['budapest'],
      0: ['budapest']
    }
  },
  {
    id: 'wien',
    name: 'Wien',
    country: 'Østrig',
    tier: 3,
    position: { x: 405, y: 265 },
    flagEmoji: '🇦🇹',
    connections: {
      3: ['budapest', 'istanbul'],
      2: ['budapest', 'istanbul'],
      1: ['budapest'],
      0: ['budapest']
    }
  },
  {
    id: 'prag',
    name: 'Prag',
    country: 'Bøhmen',
    tier: 3,
    position: { x: 380, y: 225 },
    flagEmoji: '🇨🇿',
    connections: {
      3: ['wien', 'budapest', 'istanbul'],
      2: ['wien', 'budapest'],
      1: ['budapest'],
      0: ['budapest']
    }
  },
  {
    id: 'budapest',
    name: 'Budapest',
    country: 'Ungarn',
    tier: 4,
    position: { x: 455, y: 290 },
    flagEmoji: '🇭🇺',
    connections: {
      3: ['istanbul'],
      2: ['istanbul'],
      1: ['istanbul'],
      0: ['istanbul']
    }
  },
  {
    id: 'istanbul',
    name: 'Istanbul',
    country: 'Osmanniske Rige',
    tier: 5, // Goal
    position: { x: 560, y: 385 },
    flagEmoji: '🇹🇷',
    connections: {} // End destination - no connections
  }
];

// City lookup map for quick access
export const CITIES_BY_ID = new Map<string, Jorden80City>(
  JORDEN80_CITIES.map(city => [city.id, city])
);

// Get city by ID
export function getCity(cityId: string): Jorden80City | undefined {
  return CITIES_BY_ID.get(cityId);
}

// Get cities by tier
export function getCitiesByTier(tier: number): Jorden80City[] {
  return JORDEN80_CITIES.filter(city => city.tier === tier);
}

// Get start city
export function getStartCity(): Jorden80City {
  return JORDEN80_CITIES.find(city => city.tier === 0)!;
}

// Get goal city
export function getGoalCity(): Jorden80City {
  return JORDEN80_CITIES.find(city => city.tier === 5)!;
}

// Victorian-era team colors (matches design doc)
export const TEAM_COLORS = [
  { id: 'red', hex: '#c73e3e', name: 'Crimson' },
  { id: 'blue', hex: '#3e6bc7', name: 'Royal Blue' },
  { id: 'green', hex: '#3e8b5a', name: 'Forest Green' },
  { id: 'purple', hex: '#7b3ec7', name: 'Imperial Purple' },
  { id: 'orange', hex: '#c77a3e', name: 'Amber' },
  { id: 'teal', hex: '#3e9b9b', name: 'Teal' }
];

// Vehicle options for teams
export const VEHICLES = [
  { id: 'balloon', emoji: '🎈', name: 'Luftballon', description: 'Med vinden i ryggen' },
  { id: 'train', emoji: '🚂', name: 'Damptog', description: 'Pålideligt og hurtigt' },
  { id: 'carriage', emoji: '🐴', name: 'Hestevogn', description: 'Klassisk elegance' },
  { id: 'ship', emoji: '⛵', name: 'Dampskib', description: 'Over hav og flod' },
  { id: 'bicycle', emoji: '🚲', name: 'Velocipede', description: 'Opfindsomt og sundt' },
  { id: 'elephant', emoji: '🐘', name: 'Elefant', description: 'Eksotisk og majestætisk' }
] as const;
