import React, { useState } from 'react';
import { Search, Loader2, MapPin, X, Target, Maximize, Hash } from 'lucide-react';
import { Coordinate } from '../types';
import { isValidCoordinate } from '../utils/geo';

// Extracted to prevent re-mounting on every render
const ActionButton = ({ onClick, icon: Icon, label, colorClass, active = false }: { onClick: (e: React.MouseEvent) => void, icon: any, label: string, colorClass: string, active?: boolean }) => (
    <button 
      type="button"
      onClick={onClick} 
      className={`w-12 h-12 rounded-2xl shadow-lg border flex flex-col items-center justify-center transition-all active:scale-95 group pointer-events-auto ${active ? 'bg-orange-600 border-orange-500 hover:bg-orange-500' : 'bg-[#1a202c] border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}
      title={label}
    >
      <Icon className={`w-5 h-5 mb-0.5 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
      <span className={`text-[8px] font-black uppercase tracking-widest hidden sm:block leading-none ${active ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}>{label}</span>
    </button>
);

interface LocationSearchProps {
  onSelectLocation: (coord: Coordinate) => void;
  onLocateMe?: () => void;
  onFitBounds?: () => void;
  className?: string;
  hideSearch?: boolean;
  labelButtons?: boolean;
  onToggleScores?: () => void;
  showScores?: boolean;
  locateFeedback?: string | null;
}

const LocationSearch: React.FC<LocationSearchProps> = ({
    onSelectLocation,
    onLocateMe,
    onFitBounds,
    className = "",
    hideSearch = false,
    labelButtons = false,
    onToggleScores,
    showScores,
    locateFeedback
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
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error("Geocoding error", err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (res: any) => {
    onSelectLocation({ lat: parseFloat(res.lat), lng: parseFloat(res.lon) });
    setShowResults(false);
    setQuery(res.display_name);
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
        />
      )}

      {onFitBounds && (
        <ActionButton 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFitBounds(); }} 
            icon={Maximize} 
            label="FIT" 
            colorClass="" 
        />
      )}

      {onToggleScores && (
        <ActionButton
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleScores(); }}
            icon={Hash}
            label="SCORES"
            colorClass=""
            active={showScores}
        />
      )}

      {locateFeedback && (
        <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg whitespace-nowrap pointer-events-auto ${
          locateFeedback.includes('Error') ? 'bg-red-600/80 text-white' :
          locateFeedback.includes('Located') ? 'bg-green-600/80 text-white' :
          'bg-blue-600/80 text-white animate-pulse'
        }`}>
          {locateFeedback}
        </div>
      )}

      {!hideSearch && (
        <div className="relative w-full min-w-[180px] sm:w-[260px] h-12">
          <form onSubmit={handleSearch} className="group relative flex items-center h-full">
            <div className="absolute left-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors z-10">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search location..."
              className="w-full h-full pl-10 pr-10 bg-[#1a202c] dark:bg-gray-900 backdrop-blur-md border-2 border-slate-700 hover:border-slate-600 rounded-2xl shadow-xl text-xs sm:text-sm outline-none focus:border-orange-500 transition-all text-white font-bold placeholder:text-slate-500"
            />
            {query && (
              <button 
                type="button" 
                onClick={() => { setQuery(''); setResults([]); setShowResults(false); }} 
                className="absolute right-3 p-1.5 text-gray-400 hover:text-white z-10 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {showResults && (results.length > 0 || (!isSearching && query)) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-[3000] animate-in slide-in-from-top-2">
              {results.length > 0 ? (
                results.map((res, idx) => (
                  <button key={idx} onClick={() => selectResult(res)} className="w-full p-3 text-left hover:bg-white/5 border-b last:border-0 border-white/5 flex items-start gap-3 transition-colors">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                    <span className="text-[10px] font-bold leading-tight text-slate-200 line-clamp-2 uppercase">{res.display_name}</span>
                  </button>
                ))
              ) : !isSearching && (
                <div className="p-4 text-center text-slate-500 text-[10px] font-black uppercase tracking-widest">No results</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
