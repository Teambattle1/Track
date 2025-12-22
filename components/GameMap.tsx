import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { GamePoint, Coordinate, GameMode, MapStyleId, Team } from '../types';
import { getLeafletIcon } from '../utils/icons';
// Added missing EyeOff import to fix "Cannot find name 'EyeOff'" error on line 268
import { Trash2, Crosshair, EyeOff } from 'lucide-react';

const UserIcon = L.divIcon({
  className: 'custom-user-icon',
  html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const getTeamColor = (teamName: string) => {
    let hash = 0;
    for (let i = 0; i < teamName.length; i++) hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
};

const createTeamIcon = (teamName: string) => {
    const color = getTeamColor(teamName);
    return L.divIcon({
        className: 'custom-team-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; color: white;">${teamName.charAt(0).toUpperCase()}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

export interface GameMapHandle {
  fitBounds: (points: GamePoint[]) => void;
  getBounds: () => { ne: Coordinate; sw: Coordinate } | null;
  getCenter: () => Coordinate;
  jumpTo: (coord: Coordinate, zoom?: number) => void;
}

interface GameMapProps {
  userLocation: Coordinate | null;
  points: GamePoint[];
  teams?: { team: Team, location: Coordinate }[]; 
  teamTrails?: Record<string, Coordinate[]>; 
  pointLabels?: Record<string, string>; 
  measurePath?: Coordinate[];
  logicLinks?: { from: Coordinate; to: Coordinate; color?: string }[]; 
  accuracy: number | null;
  mode: GameMode;
  mapStyle: MapStyleId;
  selectedPointId?: string | null;
  isRelocating?: boolean;
  onPointClick: (point: GamePoint) => void;
  onTeamClick?: (teamId: string) => void; 
  onMapClick?: (coord: Coordinate) => void;
  onPointMove?: (pointId: string, newLoc: Coordinate) => void;
  onDeletePoint?: (pointId: string) => void;
  onPointHover?: (point: GamePoint | null) => void;
}

const MapClickParams = ({ onClick }: { onClick?: (c: Coordinate) => void }) => {
  useMapEvents({
    click(e) {
      if (onClick) onClick(e.latlng);
    },
  });
  return null;
};

const RecenterMap = ({ center, points, mode }: { center: Coordinate | null, points: GamePoint[], mode: GameMode }) => {
  const map = useMap();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    // In EDIT or INSTRUCTOR mode, prioritize fitting bounds to existing points if they exist.
    // This helps editors who are indoors/remote see the content immediately rather than their GPS location.
    if ((mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && points.length > 0) {
        const latLngs = points.map(p => [p.location.lat, p.location.lng] as [number, number]);
        const bounds = L.latLngBounds(latLngs);
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], animate: false });
            initializedRef.current = true;
            return;
        }
    }

    // Default: Center on user location if available
    if (center) {
      map.setView([center.lat, center.lng], 16);
      initializedRef.current = true;
    }
  }, [center, points, mode, map]);

  return null;
};

const MapController = ({ handleRef }: { handleRef: React.RefObject<any> }) => {
    const map = useMap();
    useImperativeHandle(handleRef, () => ({
        fitBounds: (pts: GamePoint[]) => {
            if (pts.length === 0) return;
            const bounds = L.latLngBounds(pts.map(p => [p.location.lat, p.location.lng]));
            map.fitBounds(bounds, { padding: [50, 50] });
        },
        getBounds: () => {
            const b = map.getBounds();
            return {
                ne: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng },
                sw: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng }
            };
        },
        getCenter: () => {
            const c = map.getCenter();
            return { lat: c.lat, lng: c.lng };
        },
        jumpTo: (coord: Coordinate, zoom: number = 17) => {
            map.flyTo([coord.lat, coord.lng], zoom, { duration: 1.5 });
        }
    }));
    return null;
};

interface MapTaskMarkerProps {
  point: GamePoint;
  mode: GameMode;
  isSelected: boolean;
  isRelocating?: boolean;
  label?: string;
  onClick: (p: GamePoint) => void;
  onMove?: (id: string, loc: Coordinate) => void;
  onDelete?: (id: string) => void;
  onHover?: (p: GamePoint | null) => void;
}

const MapTaskMarker: React.FC<MapTaskMarkerProps> = ({ 
  point, 
  mode, 
  isSelected,
  isRelocating,
  label,
  onClick, 
  onMove, 
  onDelete,
  onHover
}) => {
  
  const markerRef = useRef<L.Marker>(null);
  const circleRef = useRef<L.Circle>(null);
  const isDraggingRef = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const map = useMap(); 
  // Disable individual drag when relocating all
  const isDraggable = (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && !isRelocating;
  const showGeofence = (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && !isRelocating;

  const hasActions = (point.logic?.onOpen?.length || 0) > 0 || 
                     (point.logic?.onCorrect?.length || 0) > 0 || 
                     (point.logic?.onIncorrect?.length || 0) > 0;

  // In Instructor mode, we want points to appear Red (like locked/not-completed) but showing their actual icon
  // effectively treating "isUnlocked" as true for icon visibility, but using Red color scheme.
  const visualIsUnlocked = mode === GameMode.INSTRUCTOR ? true : point.isUnlocked;
  const visualIsCompleted = mode === GameMode.INSTRUCTOR ? false : point.isCompleted;
  // Override icon color for Instructor mode to be Red
  const forcedColor = mode === GameMode.INSTRUCTOR ? '#ef4444' : undefined;

  useEffect(() => {
      if (markerRef.current && !isDraggingRef.current) {
          markerRef.current.setLatLng([point.location.lat, point.location.lng]);
      }
      if (circleRef.current && !isDraggingRef.current) {
          circleRef.current.setLatLng([point.location.lat, point.location.lng]);
      }
  }, [point.location.lat, point.location.lng]);

  const eventHandlers = React.useMemo(
    () => ({
      click: () => onClick(point),
      mouseover: () => {
        if (onHover) {
          hoverTimeoutRef.current = window.setTimeout(() => {
            onHover(point);
          }, 1000);
        }
      },
      mouseout: () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        if (onHover) onHover(null);
      },
      dragstart: () => {
          isDraggingRef.current = true;
          const trash = document.getElementById('map-trash-bin');
          if (trash) {
              trash.classList.add('bg-red-600', 'text-white', 'border-red-600', 'scale-110');
              trash.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-400', 'dark:text-gray-200', 'border-gray-100', 'dark:border-gray-700');
          }
      },
      drag: (e: L.LeafletEvent) => {
          const marker = e.target as L.Marker;
          if (circleRef.current) {
              circleRef.current.setLatLng(marker.getLatLng());
          }
      },
      dragend(e: L.LeafletEvent) {
        isDraggingRef.current = false;
        const marker = e.target as L.Marker;
        const trash = document.getElementById('map-trash-bin');
        
        if (trash) {
            trash.classList.remove('bg-red-600', 'text-white', 'border-red-600', 'scale-110');
            trash.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-400', 'dark:text-gray-200', 'border-gray-100', 'dark:border-gray-700');
        }

        if (marker) {
          if (mode === GameMode.EDIT && onDelete && trash) {
              const markerPoint = map.latLngToContainerPoint(marker.getLatLng());
              const trashRect = trash.getBoundingClientRect();
              const mapRect = map.getContainer().getBoundingClientRect();
              const hitX = mapRect.left + markerPoint.x;
              const hitY = mapRect.top + markerPoint.y;
              const hitMargin = 40;
              if (hitX >= trashRect.left - hitMargin && hitX <= trashRect.right + hitMargin && hitY >= trashRect.top - hitMargin && hitY <= trashRect.bottom + hitMargin) {
                  onDelete(point.id); return; 
              }
          }
          if (onMove) onMove(point.id, marker.getLatLng());
        }
      },
    }),
    [point, onClick, onMove, onDelete, onHover, map, mode]
  );

  useEffect(() => {
      const marker = markerRef.current;
      if (marker) {
          // Reduce opacity significantly if relocating to simulate "Cut" effect
          const targetOpacity = isRelocating ? 0.4 : (isSelected ? 1 : (isDraggable ? 0.9 : 1));
          marker.setOpacity(targetOpacity);
          marker.setZIndexOffset(isSelected ? 1000 : (isDraggable ? 500 : 0));
          if (marker.dragging) isDraggable ? marker.dragging.enable() : marker.dragging.disable();
      }
  }, [isSelected, isDraggable, isRelocating]);

  // Determine circle color
  const circleColor = isSelected ? '#4f46e5' : (forcedColor || (visualIsUnlocked ? (visualIsCompleted ? '#22c55e' : '#eab308') : '#ef4444'));

  // Prepare tooltip content safely
  const questionText = typeof point.task.question === 'string' ? point.task.question.replace(/<[^>]*>?/gm, '') : '';

  return (
    <>
      <Marker 
        draggable={isDraggable} 
        eventHandlers={eventHandlers} 
        position={[point.location.lat, point.location.lng]} 
        icon={getLeafletIcon(point.iconId, visualIsUnlocked, visualIsCompleted, label, (hasActions || point.isHiddenBeforeScan) && (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR), forcedColor, point.isHiddenBeforeScan)} 
        ref={markerRef} 
      >
        {mode === GameMode.EDIT && (
            <Tooltip direction="top" offset={[0, -40]} opacity={0.9}>
                <div className="flex flex-col items-center text-center max-w-[200px]">
                    <span className="font-bold text-xs uppercase mb-1">{point.title}</span>
                    {point.isHiddenBeforeScan && <span className="text-[9px] font-black text-purple-500 uppercase mb-1 flex items-center gap-1"><EyeOff className="w-2.5 h-2.5" /> HIDDEN UNTIL SCAN</span>}
                    {questionText && (
                        <span className="text-[10px] leading-tight text-gray-600 dark:text-gray-300 line-clamp-3">
                            {questionText}
                        </span>
                    )}
                </div>
            </Tooltip>
        )}
      </Marker>
      <Circle 
        ref={circleRef} 
        center={[point.location.lat, point.location.lng]} 
        radius={point.radiusMeters} 
        pathOptions={{ 
            color: circleColor, 
            fillColor: circleColor, 
            fillOpacity: showGeofence ? (isSelected ? 0.4 : 0.2) : 0.1, 
            weight: showGeofence ? (isSelected ? 3 : 2) : 1, 
            dashArray: visualIsUnlocked ? undefined : '5, 5' 
        }} 
      />
    </>
  );
};

const MAP_LAYERS: Record<MapStyleId, { url: string; attribution: string }> = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri' },
  dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap' },
  light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap' }
};

const GameMap = forwardRef<GameMapHandle, GameMapProps>(({ userLocation, points, teams, teamTrails, pointLabels, measurePath, logicLinks, accuracy, mode, mapStyle, selectedPointId, isRelocating, onPointClick, onTeamClick, onMapClick, onPointMove, onDeletePoint, onPointHover }, ref) => {
  const center = userLocation || { lat: 55.6761, lng: 12.5683 };
  const currentLayer = MAP_LAYERS[mapStyle] || MAP_LAYERS.osm;
  
  // FILTER: Only show points that are NOT in a playground (unless they are section headers)
  // Logic update: Also hide "isHiddenBeforeScan" tasks for players if not unlocked
  const mapPoints = points.filter(p => {
      if (p.isSectionHeader || p.playgroundId) return false;
      
      // If in Play Mode, hide tasks that are marked "Hidden Before Scan" and are NOT yet unlocked
      if (mode === GameMode.PLAY && p.isHiddenBeforeScan && !p.isUnlocked) {
          return false;
      }

      return true;
  });
  
  const getLabel = (point: GamePoint) => {
      if (pointLabels && pointLabels[point.id]) return pointLabels[point.id];
      if (mode === GameMode.EDIT) return (points.findIndex(p => p.id === point.id) + 1).toString().padStart(3, '0');
      return undefined;
  };
  return (
    <div className="relative w-full h-full">
        {/* CROSSHAIR FOR RELOCATION */}
        {isRelocating && (
            <div className="absolute inset-0 pointer-events-none z-[5000] flex items-center justify-center">
                <div className="relative">
                    <Crosshair className="w-12 h-12 text-green-500 opacity-80" strokeWidth={2} />
                    <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-green-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
                </div>
            </div>
        )}

        <MapContainer center={[center.lat, center.lng]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <MapController handleRef={ref as any} />
            <TileLayer attribution={currentLayer.attribution} url={currentLayer.url} />
            <RecenterMap center={userLocation} points={mapPoints} mode={mode} />
            {mode === GameMode.EDIT && <MapClickParams onClick={onMapClick} />}
            {userLocation && (
                <>
                <Marker position={[userLocation.lat, userLocation.lng]} icon={UserIcon} zIndexOffset={500} />
                {accuracy && <Circle center={[userLocation.lat, userLocation.lng]} radius={accuracy} pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, color: '#3b82f6', weight: 1 }} />}
                </>
            )}
            
            {/* Logic Connections Visualization */}
            {logicLinks && logicLinks.map((link, idx) => (
                <Polyline 
                    key={`link-${idx}`} 
                    positions={[[link.from.lat, link.from.lng], [link.to.lat, link.to.lng]]} 
                    pathOptions={{ color: link.color || '#eab308', weight: 3, dashArray: '10, 10', opacity: 0.8 }} 
                />
            ))}

            {/* Measure Path Polyline */}
            {measurePath && measurePath.length > 1 && (
                <Polyline 
                    positions={measurePath.map(c => [c.lat, c.lng])} 
                    pathOptions={{ color: '#ec4899', weight: 4, dashArray: '10, 10', opacity: 0.8 }} 
                />
            )}

            {teamTrails && teams && Object.entries(teamTrails).map(([teamId, path]) => {
                const team = teams.find(t => t.team.id === teamId)?.team;
                const pathCoords = path as Coordinate[];
                if (!team || pathCoords.length < 2) return null;
                return <Polyline key={`trail-${teamId}`} positions={pathCoords.map(c => [c.lat, c.lng])} pathOptions={{ color: getTeamColor(team.name), weight: 3, opacity: 0.6, dashArray: '5, 10' }} />;
            })}
            {teams && teams.map((item, idx) => <Marker key={`team-${item.team.id}-${idx}`} position={[item.location.lat, item.location.lng]} icon={createTeamIcon(item.team.name)} eventHandlers={{ click: () => onTeamClick && onTeamClick(item.team.id) }} zIndexOffset={1000} />)}
            {mapPoints.map(point => <MapTaskMarker key={point.id} point={point} mode={mode} isRelocating={isRelocating} isSelected={selectedPointId === point.id} label={getLabel(point)} onClick={onPointClick} onMove={onPointMove} onDelete={onDeletePoint} onPointHover={onPointHover} />)}
        </MapContainer>
        {mode === GameMode.EDIT && !isRelocating && (
            <div id="map-trash-bin" className="absolute bottom-6 right-4 z-[2000] shadow-xl rounded-full p-3 transition-all border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-200 pointer-events-auto flex items-center justify-center w-14 h-14" title="Drag task here to delete"><Trash2 className="w-6 h-6 pointer-events-none" /></div>
        )}
    </div>
  );
});

export default GameMap;