/**
 * Hardcoded team names for Around The World game
 * Victorian/1880s themed English names
 */

export interface VictorianTeamName {
  id: string;
  name: string;
  motto: string;
  icon: string; // Emoji
  color: string; // Hex color
}

export const VICTORIAN_TEAM_NAMES: VictorianTeamName[] = [
  {
    id: 'fogg-expedition',
    name: 'The Fogg Expedition',
    motto: 'Punctuality is the politeness of kings',
    icon: '🎩',
    color: '#3e6bc7'
  },
  {
    id: 'explorateurs',
    name: 'Club des Explorateurs',
    motto: 'Fortune favours the bold',
    icon: '🧭',
    color: '#c73e3e'
  },
  {
    id: 'steam-pioneers',
    name: 'The Steam Pioneers',
    motto: 'Progress through innovation',
    icon: '🚂',
    color: '#5c4a3a'
  },
  {
    id: 'globe-trotters',
    name: 'The Globe Trotters',
    motto: 'The world is our oyster',
    icon: '🌍',
    color: '#3e8b5a'
  },
  {
    id: 'royal-geographic',
    name: 'Royal Geographic Society',
    motto: 'Knowledge through exploration',
    icon: '📜',
    color: '#7b3ec7'
  },
  {
    id: 'orient-express',
    name: 'Orient Express Company',
    motto: 'Elegance in motion',
    icon: '🚃',
    color: '#c77a3e'
  },
  {
    id: 'balloon-society',
    name: 'The Balloon Society',
    motto: 'Above the clouds, beyond limits',
    icon: '🎈',
    color: '#3e9b9b'
  },
  {
    id: 'victorian-voyagers',
    name: 'Victorian Voyagers',
    motto: 'Adventure awaits the curious',
    icon: '⛵',
    color: '#8b6914'
  },
  {
    id: 'reform-club',
    name: 'The Reform Club',
    motto: 'Gentlemen of distinction',
    icon: '🏛️',
    color: '#4a4a6a'
  },
  {
    id: 'meridian-masters',
    name: 'Meridian Masters',
    motto: 'Time waits for no one',
    icon: '⏱️',
    color: '#8b4513'
  },
  {
    id: 'empire-adventurers',
    name: 'Empire Adventurers',
    motto: 'From London to the world',
    icon: '👑',
    color: '#b8860b'
  },
  {
    id: 'passepartout-guild',
    name: 'Passepartout Guild',
    motto: 'Resourcefulness is our creed',
    icon: '🔑',
    color: '#6b8e23'
  }
];

// Get team name by ID
export function getTeamName(id: string): VictorianTeamName | undefined {
  return VICTORIAN_TEAM_NAMES.find(t => t.id === id);
}

// Get available team names (filter out taken ones)
export function getAvailableTeamNames(takenIds: string[]): VictorianTeamName[] {
  return VICTORIAN_TEAM_NAMES.filter(t => !takenIds.includes(t.id));
}
