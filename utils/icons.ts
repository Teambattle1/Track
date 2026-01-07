import L from 'leaflet';
import { IconId } from '../types';
import { MapPin, Star, Flag, Trophy, Camera, HelpCircle, Skull, Gem, ListOrdered, Music, Leaf, Globe } from 'lucide-react';
import React from 'react';

// Mapping for UI components (React)
export const ICON_COMPONENTS: Record<IconId | 'timeline', React.ElementType> = {
  default: MapPin,
  star: Star,
  flag: Flag,
  trophy: Trophy,
  camera: Camera,
  question: HelpCircle,
  skull: Skull,
  treasure: Gem,
  music: Music,
  nature: Leaf,
  world: Globe,
  timeline: ListOrdered // Added fallback mapping just in case
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
  music: '#ec4899',   // Pink
  nature: '#22c55e',  // Green
  world: '#06b6d4',   // Cyan
};

/**
 * Generates a Leaflet DivIcon based on the icon ID and state.
 * We use SVGs as strings because Leaflet doesn't render React components directly easily.
 */
export const getLeafletIcon = (
    iconId: IconId,
    isUnlocked: boolean,
    isCompleted: boolean,
    label?: string,
    hasActions?: boolean,
    forcedColor?: string,
    isHidden?: boolean,
    score?: number, // New: Score display
    iconUrl?: string, // New: Custom Icon URL
    isPlaygroundActivator?: boolean, // New: Glow effect for playground activators
    showCompletionBadge?: boolean, // New: Show green check or red X on completed tasks
    wasAnsweredCorrectly?: boolean // New: True = green check, False = red X
) => {
  const color = forcedColor || (isCompleted ? '#22c55e' : (isUnlocked ? '#eab308' : ICON_COLORS[iconId] || '#3b82f6'));
  const size = isUnlocked ? 40 : 32;
  
  // Base container style
  // If isPlaygroundActivator is true, add a heavy orange glow and border
  const glowStyle = isPlaygroundActivator
    ? `filter: drop-shadow(0px 0px 8px #f97316); border-radius: 50%; box-shadow: 0 0 0 3px #f97316, 0 0 15px 5px rgba(249, 115, 22, 0.6); animation: pulse-orange 2s infinite;`
    : `filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.3));`;

  // Container for the icon marker - keep reasonable size for proper map positioning
  const iconContainerSize = 60; // Size of the visible icon circle
  let html = `<div style="${glowStyle} transition: all 0.2s; position: relative; display: flex; align-items: center; justify-content: center; border-radius: 50%; width: ${iconContainerSize}px; height: ${iconContainerSize}px;">`;

  // Center the icon within the expanded container
  const iconContainerStyle = `position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);`;

  if (iconUrl) {
      // CUSTOM ICON RENDERER
      html += `<div style="${iconContainerStyle} width: ${size}px; height: ${size}px; background-image: url('${iconUrl}'); background-size: cover; background-position: center; border-radius: 50%; border: 2px solid ${color}; background-color: white;"></div>`;
  } else {
      // DEFAULT SVG RENDERER
      const svgs: Record<IconId, string> = {
        default: `<path d="M20 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="11" cy="10" r="3" fill="white"/>`,
        star: `<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="${color}" stroke="white" stroke-width="2"/>`,
        flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="${color}" stroke="white" stroke-width="2"/><line x1="4" y1="22" x2="4" y2="15" stroke="${color}" stroke-width="3"/>`,
        trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" stroke="${color}" stroke-width="2"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" stroke="${color}" stroke-width="2"/><path d="M4 22h16" stroke="${color}" stroke-width="2"/><path d="M8 22l1-9h6l1 9" fill="${color}" stroke="white" stroke-width="1"/><path d="M12 6V2" stroke="${color}" stroke-width="2"/>`,
        camera: `<rect x="2" y="6" width="20" height="12" rx="2" fill="${color}" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="white" stroke-width="2"/>`,
        question: `<circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="white" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="white" stroke-width="3"/>`,
        skull: `<circle cx="9" cy="12" r="1" fill="white"/><circle cx="15" cy="12" r="1" fill="white"/><path d="M12 2a8 8 0 0 0-8 8c0 4.5 3.5 7.5 5 9h6c1.5-1.5 5-4.5 5-9a8 8 0 0 0-8-8z" fill="${color}" stroke="white" stroke-width="2"/>`,
        treasure: `<path d="M6 3h12l4 6-10 13L2 9z" fill="${color}" stroke="white" stroke-width="2"/><path d="M11 3l-5 6h12l-5-6" fill="white" fill-opacity="0.3"/>`,
        music: `<path d="M9 18V5l12-2v13A4 4 0 1 1 15 15a4 4 0 0 0 4-4V3" fill="none" stroke="${color}" stroke-width="2"/><circle cx="6" cy="18" r="3" fill="${color}" stroke="white" stroke-width="2"/>`,
        nature: `<path d="M12 2c1 1 2 2 3 4 1-2 2-3 3-4M9 7c0 2 1 4 3 6-2 2-3 4-3 6M15 7c0 2-1 4-3 6 2 2 3 4 3 6M12 22c-3-2-5-5-5-8 0-4 2-7 5-9 3 2 5 5 5 9 0 3-2 6-5 8z" fill="${color}" stroke="white" stroke-width="1.5"/>`,
        world: `<circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="2"/><path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20z" fill="none" stroke="${color}" stroke-width="2"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="${color}" stroke-width="2"/>`
      };

      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" style="${iconContainerStyle}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgs[iconId] || svgs.default}</svg>`;
      html += svgContent;
  }

  // Score Badge - Bottom Center (bottom: -16px) to separate from label
  if (score !== undefined) {
      html += `<div style="position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%); background-color: #3b82f6; color: white; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px; border: 1px solid white; box-shadow: 0 2px 2px rgba(0,0,0,0.2); z-index: 21;">${score}</div>`;
  }

  // Hidden Badge - Top Left (Purple Eye)
  if (isHidden) {
      html += `<div style="position: absolute; top: -6px; left: -8px; width: 16px; height: 16px; background-color: #8b5cf6; border-radius: 50%; border: 2px solid white; z-index: 22; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><svg viewBox="0 0 24 24" width="10" height="10" stroke="white" stroke-width="3" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg></div>`;
  }

  // Logic Badge - Bottom Right (Red Dot)
  if (hasActions) {
      html += `<div class="animate-pulse" style="position: absolute; bottom: 0px; right: -4px; width: 10px; height: 10px; background-color: #ef4444; border-radius: 50%; box-shadow: 0 0 4px 1px rgba(239,68,68,0.8); border: 2px solid white; z-index: 23;"></div>`;
  }

  // Completion Badge - Center Overlay (Green Checkmark or Red X)
  if (showCompletionBadge && isCompleted) {
      const badgeColor = wasAnsweredCorrectly ? '#22c55e' : '#ef4444'; // Green or Red
      const badgeIcon = wasAnsweredCorrectly
          ? '<path d="M5 12l5 5L20 7" stroke="white" stroke-width="3" fill="none"/>' // Checkmark
          : '<path d="M6 6l12 12M18 6L6 18" stroke="white" stroke-width="3"/>';      // X

      html += `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background-color: ${badgeColor}; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 24;"><svg viewBox="0 0 24 24" width="16" height="16">${badgeIcon}</svg></div>`;
  }

  // ID Label - Centered ABOVE the icon (pill shape) - Added last for highest visual z-order
  if (label) {
      // For longer labels, allow 2-line wrapping; for short labels, keep single line
      const maxWidth = label.length > 15 ? '60px' : 'auto';
      const lineHeight = label.length > 15 ? '1.2' : '1';
      const topOffset = label.length > 15 ? '-36px' : '-24px';
      const paddingVertical = label.length > 15 ? '2px' : '1px';
      const wordBreak = label.length > 15 ? 'word-break: break-word;' : '';

      html += `<div style="position: absolute; top: ${topOffset}; left: 50%; transform: translateX(-50%); background-color: #0f172a; color: white; font-size: 8px; font-weight: 900; padding: ${paddingVertical} 5px; border-radius: 8px; border: 1px solid white; z-index: 999; max-width: ${maxWidth}; line-height: ${lineHeight}; text-align: center; ${wordBreak} pointer-events: none;">${label}</div>`;
  }

  html += `</div>`;

  return L.divIcon({
    className: 'custom-game-icon',
    html: html,
    iconSize: [iconContainerSize, iconContainerSize + 24], // Icon height + label space above
    iconAnchor: [iconContainerSize/2, iconContainerSize], // Bottom center of actual icon
    popupAnchor: [0, -iconContainerSize],
  });
};
