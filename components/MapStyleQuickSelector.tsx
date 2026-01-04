import React, { useState } from 'react';
import { Layers, Globe, MapIcon, Mountain, Snowflake, ScrollText } from 'lucide-react';
import { MapStyleId } from '../types';

interface MapStyleQuickSelectorProps {
  currentStyle: MapStyleId;
  onStyleChange: (styleId: MapStyleId) => void;
}

const MAP_STYLES_LIST: { id: MapStyleId; label: string; icon: any; preview?: string; className?: string }[] = [
  { id: 'osm', label: 'Standard', icon: Globe, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png' },
  { id: 'satellite', label: 'Satellite', icon: Layers, preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/2722/4285' },
  { id: 'dark', label: 'Dark Mode', icon: MapIcon, preview: 'https://a.basemaps.cartocdn.com/dark_all/13/4285/2722.png' },
  { id: 'historic', label: 'Historic', icon: ScrollText, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'sepia-[.7] contrast-125 brightness-90' },
  { id: 'winter', label: 'Winter', icon: Mountain, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'brightness-125 hue-rotate-180 saturate-50' },
  { id: 'ski', label: 'Ski Map', icon: Snowflake, preview: 'https://tiles.opensnowmap.org/base_snow_map/13/4285/2722.png' },
  { id: 'treasure', label: 'Treasure', icon: ScrollText, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'sepia-[.9] contrast-110 brightness-95 hue-rotate-30' },
  { id: 'desert', label: 'Desert', icon: Mountain, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'saturate-150 hue-rotate-15 brightness-110 contrast-105' },
  { id: 'clean', label: 'Clean', icon: Globe, preview: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/13/4285/2722.png' },
];

const MapStyleQuickSelector: React.FC<MapStyleQuickSelectorProps> = ({ currentStyle, onStyleChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredStyle, setHoveredStyle] = useState<MapStyleId | null>(null);

  const currentStyleData = MAP_STYLES_LIST.find(s => s.id === currentStyle);
  const CurrentIcon = currentStyleData?.icon || Layers;

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className={`group bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl hover:shadow-orange-500/20 transition-all duration-200 hover:scale-105 active:scale-95 p-3 ${
          isOpen ? 'border-orange-500 shadow-orange-500/30' : ''
        }`}
        title={`Map Style: ${currentStyleData?.label || 'Standard'}`}
      >
        <CurrentIcon className={`w-6 h-6 transition-colors ${
          isOpen ? 'text-orange-500' : 'text-slate-700 dark:text-slate-300 group-hover:text-orange-500'
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close on click outside */}
          <div 
            className="fixed inset-0 z-[-1]" 
            onClick={() => setIsOpen(false)}
            onMouseEnter={() => setIsOpen(false)}
          />
          
          <div 
            className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200"
            onMouseLeave={() => {
              setIsOpen(false);
              setHoveredStyle(null);
            }}
          >
            {/* Style Options */}
            <div className="flex flex-col min-w-[200px]">
              {MAP_STYLES_LIST.map((style) => {
                const Icon = style.icon;
                const isActive = currentStyle === style.id;
                const isHovered = hoveredStyle === style.id;

                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      onStyleChange(style.id);
                      setIsOpen(false);
                      setHoveredStyle(null);
                    }}
                    onMouseEnter={() => setHoveredStyle(style.id)}
                    onMouseLeave={() => setHoveredStyle(null)}
                    className={`relative flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-slate-200 dark:border-slate-800 last:border-b-0 ${
                      isActive 
                        ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-orange-500' : ''}`} />
                    <span className="font-bold text-sm uppercase tracking-wide flex-1">
                      {style.label}
                    </span>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 animate-pulse shadow-lg shadow-orange-500/50" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Hover Preview Thumbnail - Appears to the left of the menu */}
      {hoveredStyle && hoveredStyle !== currentStyle && (
        <div className="absolute top-0 right-[220px] z-[1001] animate-in fade-in slide-in-from-right-2 duration-200">
          <div className="bg-slate-900 border-2 border-orange-500 rounded-2xl shadow-2xl overflow-hidden">
            <div className="relative w-64 h-64">
              {/* Thumbnail Image */}
              <img
                src={MAP_STYLES_LIST.find(s => s.id === hoveredStyle)?.preview}
                alt={MAP_STYLES_LIST.find(s => s.id === hoveredStyle)?.label}
                className={`w-full h-full object-cover ${MAP_STYLES_LIST.find(s => s.id === hoveredStyle)?.className || ''}`}
                loading="eager"
              />
              
              {/* Label Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
                <p className="text-white font-black text-lg uppercase tracking-widest text-center">
                  {MAP_STYLES_LIST.find(s => s.id === hoveredStyle)?.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapStyleQuickSelector;
