
import React, { useState } from 'react';
import { Search, Loader2, MapPin, X, Target, Maximize } from 'lucide-react';
import { Coordinate } from '../types';

interface LocationSearchProps {
  onSelectLocation: (coord: Coordinate) => void;
  onLocateMe?: () => void;
  onFitBounds?: () => void;
  className?: string;
  hideSearch?: boolean;
}

const LocationSearch: React.FC<LocationSearchProps> = ({ onSelectLocation, onLocateMe, onFitBounds, className = "", hideSearch = false }) => {
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
    <div className={`flex items-center gap-2 pointer-events-auto h-12 ${className}`}>
      {!hideSearch && (
        <div className="relative w-full min-w-[180px] sm:w-[260px] h-full">
          <form onSubmit={handleSearch} className="group relative flex items-center h-full">
            <div className="absolute left-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors z-10">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search location..."
              title="Search for a place on the map"
              className="w-full h-full pl-10 pr-10 bg-slate-900/95 dark:bg-gray-850 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-white font-bold"
            />
            {query && (
              <button 
                type="button" 
                onClick={() => { setQuery(''); setResults([]); setShowResults(false); }} 
                title="Clear Search"
                className="absolute right-3 p-1.5 text-gray-400 hover:text-gray-200 z-10 bg-white/5 rounded-lg"
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

      <div className="flex gap-1.5 h-full">
          {onLocateMe && (
            <div className="relative group h-12 w-12">
              <button 
                onClick={onLocateMe} 
                title="Locate Me (GPS)"
                className="w-full h-full bg-slate-900/95 dark:bg-gray-850 backdrop-blur-md text-blue-400 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95" 
                aria-label="Locate Me"
              >
                <Target className="w-6 h-6" />
              </button>
              <div className="absolute bottom-full mb-2 right-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">My Location</div>
            </div>
          )}

          {onFitBounds && (
            <div className="relative group h-12 w-12">
              <button 
                onClick={onFitBounds} 
                title="Show All Tasks"
                className="w-full h-full bg-slate-900/95 dark:bg-gray-850 backdrop-blur-md text-orange-400 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95" 
                aria-label="Fit Map to Tasks"
              >
                <Maximize className="w-6 h-6" />
              </button>
              <div className="absolute bottom-full mb-2 right-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap">View All</div>
            </div>
          )}
      </div>
    </div>
  );
};

export default LocationSearch;
