import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { GamePoint, Coordinate, GameMode, MapStyleId } from '../types';
import { getLeafletIcon } from '../utils/icons';

const UserIcon = L.divIcon({
  className: 'custom-user-icon',
  html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

interface GameMapProps {
  userLocation: Coordinate | null;
  points: GamePoint[];
  accuracy: number | null;
  mode: GameMode;
  mapStyle: MapStyleId;
  selectedPointId?: string | null;
  onPointClick: (point: GamePoint) => void;
  onMapClick?: (coord: Coordinate) => void;
  onPointMove?: (pointId: string, newLoc: Coordinate) => void;
}

const MapClickParams = ({ onClick }: { onClick?: (c: Coordinate) => void }) => {
  useMapEvents({
    click(e) {
      if (onClick) onClick(e.latlng);
    },
  });
  return null;
};

const RecenterMap = ({ center }: { center: Coordinate | null }) => {
  const map = useMap();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (center && !initialized) {
      map.setView([center.lat, center.lng], 16);
      setInitialized(true);
    }
  }, [center, map, initialized]);

  return null;
};

// Component for a Draggable Marker
const DraggableMarker = ({ 
  point, 
  mode, 
  isSelected,
  label,
  onClick, 
  onMove 
}: { 
  point: GamePoint, 
  mode: GameMode, 
  isSelected: boolean,
  label?: string,
  onClick: (p: GamePoint) => void,
  onMove?: (id: string, loc: Coordinate) => void 
}) => {
  
  const markerRef = useRef<L.Marker>(null);
  const isDraggable = mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR;

  const eventHandlers = React.useMemo(
    () => ({
      click: () => onClick(point),
      // Removed 'drag' event listener to prevent continuous state updates 
      // which cause re-renders that interrupt the drag gesture.
      dragend(e: L.LeafletEvent) {
        const marker = e.target;
        if (marker && onMove) {
          const { lat, lng } = marker.getLatLng();
          onMove(point.id, { lat, lng });
        }
      },
    }),
    [point, onClick, onMove]
  );

  // Apply a visual effect if selected in edit mode
  useEffect(() => {
      if (markerRef.current) {
          if (isSelected) {
              markerRef.current.setOpacity(1);
              markerRef.current.setZIndexOffset(1000);
          } else {
              markerRef.current.setOpacity(isDraggable ? 0.9 : 1);
              markerRef.current.setZIndexOffset(0);
          }
      }
  }, [isSelected, isDraggable]);

  return (
    <Marker
      draggable={isDraggable}
      eventHandlers={eventHandlers}
      position={[point.location.lat, point.location.lng]}
      icon={getLeafletIcon(point.iconId, point.isUnlocked, point.isCompleted, label)}
      ref={markerRef}
      zIndexOffset={isDraggable ? 500 : 0}
    />
  );
};

const MAP_LAYERS: Record<MapStyleId, { url: string; attribution: string }> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

const GameMap: React.FC<GameMapProps> = ({ 
  userLocation, 
  points, 
  accuracy, 
  mode,
  mapStyle,
  selectedPointId,
  onPointClick, 
  onMapClick,
  onPointMove
}) => {
  
  const defaultCenter = { lat: 55.6761, lng: 12.5683 };
  const center = userLocation || defaultCenter;

  const showGeofence = mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR;
  const currentLayer = MAP_LAYERS[mapStyle] || MAP_LAYERS.osm;

  // Filter out dividers for the map view
  const mapPoints = points.filter(p => !p.isSectionHeader);
  
  // Calculate labels based on overall index to keep them consistent
  // However, if we filter dividers, indices might shift relative to map. 
  // Ideally, user wants to see the ID that corresponds to the playlist order.
  // So we map the original list to find the index.
  const getLabel = (point: GamePoint) => {
      if (mode !== GameMode.EDIT) return undefined;
      const idx = points.findIndex(p => p.id === point.id);
      return (idx + 1).toString().padStart(3, '0');
  };

  return (
    <MapContainer 
      center={[center.lat, center.lng]} 
      zoom={15} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution={currentLayer.attribution}
        url={currentLayer.url}
      />

      <RecenterMap center={userLocation} />
      
      {mode === GameMode.EDIT && <MapClickParams onClick={onMapClick} />}

      {/* User Position */}
      {userLocation && (
        <>
          <Marker position={[userLocation.lat, userLocation.lng]} icon={UserIcon} zIndexOffset={500} />
          {accuracy && (
            <Circle 
              center={[userLocation.lat, userLocation.lng]} 
              radius={accuracy} 
              pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, color: '#3b82f6', weight: 1 }} 
            />
          )}
        </>
      )}

      {/* Game Points */}
      {mapPoints.map(point => {
        const isSelected = selectedPointId === point.id;
        return (
            <React.Fragment key={point.id}>
            <DraggableMarker 
                point={point} 
                mode={mode} 
                isSelected={isSelected}
                label={getLabel(point)}
                onClick={onPointClick} 
                onMove={onPointMove}
            />
            
            {/* Geofence Visualization */}
            <Circle 
                center={[point.location.lat, point.location.lng]} 
                radius={point.radiusMeters} 
                pathOptions={{ 
                color: isSelected ? '#4f46e5' : (point.isUnlocked ? (point.isCompleted ? '#22c55e' : '#eab308') : '#ef4444'), 
                fillColor: isSelected ? '#6366f1' : (point.isUnlocked ? (point.isCompleted ? '#22c55e' : '#eab308') : '#ef4444'),
                fillOpacity: showGeofence ? (isSelected ? 0.4 : 0.2) : 0.1,
                weight: showGeofence ? (isSelected ? 3 : 2) : 1,
                dashArray: point.isUnlocked ? undefined : '5, 5'
                }} 
            />
            </React.Fragment>
        );
      })}
    </MapContainer>
  );
};

export default GameMap;