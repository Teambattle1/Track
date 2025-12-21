
import L from 'leaflet';
import { IconId } from '../types';
import { MapPin, Star, Flag, Trophy, Camera, HelpCircle, Skull, Gem } from 'lucide-react';
import React from 'react';

// Mapping for UI components (React)
export const ICON_COMPONENTS: Record<IconId, React.ElementType> = {
  default: MapPin,
  star: Star,
  flag: Flag,
  trophy: Trophy,
  camera: Camera,
  question: HelpCircle,
  skull: Skull,
  treasure: Gem,
};

// Colors for the icons
const ICON_COLORS: Record<IconId, string> = {
  default: '#3b82f6', // Blue
  star: '#eab308',    // Yellow
  flag: '#ef4444',    // Red
  trophy: '#f59e0b',  // Amber
  camera: '#6366f1',  // Indigo
  question: '#8b5cf6', // Violet
  skull: '#1f2937',   // Gray
  treasure: '#10b981', // Emerald
};

/**
 * Generates a Leaflet DivIcon based on the icon ID and state.
 * We use SVGs as strings because Leaflet doesn't render React components directly easily.
 */
export const getLeafletIcon = (iconId: IconId, isUnlocked: boolean, isCompleted: boolean, label?: string, hasActions?: boolean, forcedColor?: string) => {
  const color = forcedColor || (isCompleted ? '#22c55e' : (isUnlocked ? '#eab308' : ICON_COLORS[iconId] || '#3b82f6'));
  const size = isUnlocked ? 40 : 32;
  
  // Simple SVG strings for the markers to avoid heavy react-dom/server dependencies in browser
  const svgs: Record<IconId, string> = {
    default: `<path d="M20 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="11" cy="10" r="3" fill="white"/>`,
    star: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="${color}" stroke="white" stroke-width="2"/>`,
    flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="${color}" stroke="white" stroke-width="2"/><line x1="4" y1="22" x2="4" y2="15" stroke="${color}" stroke-width="3"/>`,
    trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" stroke="${color}" stroke-width="2"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" stroke="${color}" stroke-width="2"/><path d="M4 22h16" stroke="${color}" stroke-width="2"/><path d="M8 22l1-9h6l1 9" fill="${color}" stroke="white" stroke-width="1"/><path d="M12 6V2" stroke="${color}" stroke-width="2"/>`,
    camera: `<rect x="2" y="6" width="20" height="12" rx="2" fill="${color}" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="white" stroke-width="2"/>`,
    question: `<circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="white" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="white" stroke-width="3"/>`,
    skull: `<circle cx="9" cy="12" r="1" fill="white"/><circle cx="15" cy="12" r="1" fill="white"/><path d="M12 2a8 8 0 0 0-8 8c0 4.5 3.5 7.5 5 9h6c1.5-1.5 5-4.5 5-9a8 8 0 0 0-8-8z" fill="${color}" stroke="white" stroke-width="2"/>`,
    treasure: `<path d="M6 3h12l4 6-10 13L2 9z" fill="${color}" stroke="white" stroke-width="2"/><path d="M11 3l-5 6h12l-5-6" fill="white" fill-opacity="0.3"/>`
  };

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgs[iconId] || svgs.default}</svg>`;
  
  let html = `<div style="filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.3)); transition: all 0.2s; position: relative;">${svgContent}`;
  
  if (label) {
      html += `<div style="position: absolute; top: -5px; right: -5px; background-color: #0f172a; color: white; font-size: 10px; font-weight: bold; padding: 2px 5px; border-radius: 9999px; border: 1px solid white;">${label}</div>`;
  }

  if (hasActions) {
      // Red glowing badge top left
      html += `<div class="animate-pulse" style="position: absolute; top: -2px; left: -2px; width: 12px; height: 12px; background-color: #ef4444; border-radius: 50%; box-shadow: 0 0 8px 2px rgba(239,68,68,0.8); border: 2px solid white; z-index: 10;"></div>`;
  }
  
  html += `</div>`;

  return L.divIcon({
    className: 'custom-game-icon',
    html: html,
    iconSize: [size, size],
    iconAnchor: [size/2, size], // Bottom center
    popupAnchor: [0, -size],
  });
};
