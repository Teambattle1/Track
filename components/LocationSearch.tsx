import React, { useState } from 'react';
import { Search, Loader2, MapPin, X, Target, Maximize } from 'lucide-react';
import { Coordinate } from '../types';
import { isValidCoordinate } from '../utils/geo';

// Extracted to prevent re-mounting on every render
const ActionButton = ({ onClick, icon: Icon, label, colorClass, active = false, compact = false, showLabel = false }: { onClick: (e: React.MouseEvent) => void, icon: any, label: string, colorClass: string, active?: boolean, compact?: boolean, showLabel?: boolean }) => (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onClick}
        className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-2xl shadow-lg border flex flex-col items-center justify-center transition-all active:scale-95 group pointer-events-auto ${active ? 'bg-orange-600 border-orange-500 hover:bg-orange-500' : 'bg-[#1a202c] border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}
        title={label}
      >
        <Icon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${compact ? 'mb-0' : 'mb-0.5'} ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
        {!compact && <span className={`text-[8px] font-black uppercase tracking-widest hidden sm:block leading-none ${active ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}>{label}</span>}
      </button>
      {showLabel && compact && <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 leading-tight text-center">{label}</span>}
    </div>
);

interface LocationSearchProps {
  onSelectLocation: (coord: Coordinate) => void;
  onLocateMe?: () => void;
  onFitBounds?: () => void;
  className?: string;
  hideSearch?: boolean;
  labelButtons?: boolean;
  locateFeedback?: string | null;
  compact?: boolean;
  showLabels?: boolean;
}

const LocationSearch: React.FC<LocationSearchProps> = ({
    onSelectLocation,
    onLocateMe,
    onFitBounds,
    className = "",
    hideSearch = false,
    labelButtons = false,
    locateFeedback,
    compact = false,
    showLabels = false
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setShowResults(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
        headers: {
          'User-Agent': 'TeamBattle-App/1.0 (+https://teambattle.io)'
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoding service error: ${response.status}`);
      }

      const data = await response.json();
      // Validate that results are an array
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        console.warn('Unexpected geocoding response format:', data);
        setResults([]);
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (res: any) => {
    const lat = parseFloat(res.lat);
    const lng = parseFloat(res.lon);

    // Validate coordinates before using them
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      onSelectLocation({ lat, lng });
      setShowResults(false);
      setQuery(res.display_name);
    } else {
      console.error('Invalid coordinates from geocoding result:', res);
    }
  };

  return (
    <div className={`flex items-center gap-2 pointer-events-auto ${className}`}>

      {/* Moved Action Buttons to the Left */}
      {onLocateMe && (
        <ActionButton
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocateMe(); }}
            icon={Target}
            label="LOCATE"
            colorClass=""
            compact={compact}
            showLabel={showLabels}
        />
      )}

      {onFitBounds && (
        <ActionButton
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFitBounds(); }}
            icon={Maximize}
            label="FIT"
            colorClass=""
            title="Fit map to all items"
            compact={compact}
            showLabel={showLabels}
        />
      )}

      {locateFeedback && !compact && (
        <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg whitespace-nowrap pointer-events-auto ${
          locateFeedback.includes('Error') ? 'bg-red-600/80 text-white' :
          locateFeedback.includes('Located') ? 'bg-green-600/80 text-white' :
          'bg-blue-600/80 text-white animate-pulse'
        }`}>
          {locateFeedback}
        </div>
      )}

      {!hideSearch && (
        <div className={`relative ${compact ? 'w-[140px]' : 'w-full min-w-[180px] sm:w-[260px]'} ${compact ? 'h-10' : 'h-12'}`}>
          <form onSubmit={handleSearch} className="group relative flex items-center h-full">
            <div className={`absolute text-gray-400 group-focus-within:text-orange-500 transition-colors z-10 ${compact ? 'left-2.5' : 'left-3.5'}`}>
              {isSearching ? <Loader2 className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`} /> : <Search className={compact ? 'w-3 h-3' : 'w-4 h-4'} />}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={compact ? "Search..." : "Search location..."}
              className={`w-full h-full ${compact ? 'pl-8 pr-8' : 'pl-10 pr-10'} bg-[#1a202c] dark:bg-gray-900 backdrop-blur-md border-2 border-slate-700 hover:border-slate-600 rounded-2xl shadow-xl ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'} outline-none focus:border-orange-500 transition-all text-white font-bold placeholder:text-slate-500`}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setShowResults(false); }}
                className={`absolute ${compact ? 'right-2' : 'right-3'} p-1.5 text-gray-400 hover:text-white z-10 bg-white/5 hover:bg-white/10 rounded-lg transition-colors`}
              >
                <X className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              </button>
            )}
          </form>

          {showResults && (results.length > 0 || (!isSearching && query)) && (
            <div className={`absolute top-full left-0 right-0 ${compact ? 'mt-1' : 'mt-2'} bg-slate-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-[3000] animate-in slide-in-from-top-2`}>
              {results.length > 0 ? (
                results.map((res, idx) => (
                  <button key={idx} onClick={() => selectResult(res)} className={`w-full text-left hover:bg-white/5 border-b last:border-0 border-white/5 flex items-start gap-2 transition-colors ${compact ? 'p-2' : 'p-3'}`}>
                    <MapPin className={`text-orange-500 shrink-0 ${compact ? 'w-3 h-3 mt-0.5' : 'w-3.5 h-3.5 mt-0.5'}`} />
                    <span className={`font-bold leading-tight text-slate-200 line-clamp-2 uppercase ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{res.display_name}</span>
                  </button>
                ))
              ) : !isSearching && (
                <div className={`text-center text-slate-500 font-black uppercase tracking-widest ${compact ? 'p-2 text-[9px]' : 'p-4 text-[10px]'}`}>No results</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
