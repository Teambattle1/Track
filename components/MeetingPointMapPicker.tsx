import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { Search, X, MapPin, Loader } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
import L from 'leaflet';
// @ts-ignore - leaflet image imports work at runtime via bundler
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore - leaflet image imports work at runtime via bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore - leaflet image imports work at runtime via bundler
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

interface SearchResult {
    display_name: string;
    lat: string;
    lon: string;
    place_id: number;
}

interface MeetingPointMapPickerProps {
    initialLat?: number;
    initialLng?: number;
    onLocationSelect: (lat: number, lng: number) => void;
    onClose: () => void;
}

// Component to handle map clicks
const MapClickHandler: React.FC<{ onLocationSelect: (lat: number, lng: number) => void }> = ({ onLocationSelect }) => {
    useMapEvents({
        click: (e) => {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

// Component to recenter map
const MapRecenter: React.FC<{ center: LatLng }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
};

// Component to handle map ready state
const MapReadyHandler: React.FC<{ onReady: () => void }> = ({ onReady }) => {
    const map = useMap();
    useEffect(() => {
        // Ensure map is fully loaded
        map.whenReady(() => {
            // Force invalidate size to ensure tiles load properly
            setTimeout(() => {
                map.invalidateSize();
                onReady();
            }, 100);
        });
    }, [map, onReady]);
    return null;
};

const MeetingPointMapPicker: React.FC<MeetingPointMapPickerProps> = ({
    initialLat = 55.6761,
    initialLng = 12.5683,
    onLocationSelect,
    onClose
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<LatLng>(new LatLng(initialLat, initialLng));
    const [mapCenter, setMapCenter] = useState<LatLng>(new LatLng(initialLat, initialLng));
    const [mapReady, setMapReady] = useState(false);

    // Search locations using Nominatim (OpenStreetMap)
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
            );
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error('Search error:', error);
            alert('Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectResult = (result: SearchResult) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const newPosition = new LatLng(lat, lng);
        setSelectedPosition(newPosition);
        setMapCenter(newPosition);
        setSearchResults([]);
        setSearchQuery('');
    };

    const handleMapClick = (lat: number, lng: number) => {
        setSelectedPosition(new LatLng(lat, lng));
    };

    const handleConfirm = () => {
        onLocationSelect(selectedPosition.lat, selectedPosition.lng);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[7000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-600/20 rounded-lg">
                            <MapPin className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase">SELECT MEETING POINT</h3>
                            <p className="text-xs text-slate-400 uppercase font-bold mt-1">Search or click on the map</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-700 shrink-0">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Search for address, city, or landmark..."
                                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white outline-none focus:border-orange-500 transition-colors uppercase font-bold"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isSearching || !searchQuery.trim()}
                            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold uppercase text-xs tracking-wide transition-colors flex items-center gap-2"
                        >
                            {isSearching ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    SEARCHING
                                </>
                            ) : (
                                <>
                                    <Search className="w-4 h-4" />
                                    SEARCH
                                </>
                            )}
                        </button>
                    </div>

                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-slate-950 border border-slate-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                            {searchResults.map((result) => (
                                <button
                                    key={result.place_id}
                                    onClick={() => handleSelectResult(result)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-b-0 group"
                                >
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                            {result.display_name}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Map Container */}
                <div className="flex-1 relative overflow-hidden">
                    {!mapReady && (
                        <div className="absolute inset-0 z-10 bg-slate-950 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <Loader className="w-8 h-8 text-orange-500 animate-spin" />
                                <p className="text-sm font-bold text-slate-400 uppercase">Loading map...</p>
                            </div>
                        </div>
                    )}
                    <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        className="z-0"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onLocationSelect={handleMapClick} />
                        <MapRecenter center={mapCenter} />
                        <MapReadyHandler onReady={() => setMapReady(true)} />
                        {selectedPosition && <Marker position={selectedPosition} />}
                    </MapContainer>
                </div>

                {/* Footer with coordinates and confirm */}
                <div className="p-4 border-t border-slate-700 bg-slate-950 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Latitude</label>
                                <div className="text-sm font-mono font-bold text-white">
                                    {selectedPosition.lat.toFixed(6)}
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Longitude</label>
                                <div className="text-sm font-mono font-bold text-white">
                                    {selectedPosition.lng.toFixed(6)}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide transition-colors"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide transition-all shadow-lg flex items-center gap-2"
                            >
                                <MapPin className="w-4 h-4" />
                                CONFIRM LOCATION
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingPointMapPicker;
