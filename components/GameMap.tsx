import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { GamePoint, Coordinate, GameMode, MapStyleId, Team, DangerZone, TeamStatus, GameRoute } from '../types';
import { getLeafletIcon } from '../utils/icons';
import { Trash2, Crosshair, EyeOff, Image as ImageIcon, CheckCircle, HelpCircle, Zap, AlertTriangle, Lock, Users, Trophy, MessageSquare, MapPin } from 'lucide-react';
import { useLocation } from '../contexts/LocationContext';
import { isValidCoordinate } from '../utils/geo';

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

const createTeamIcon = (teamName: string, photoUrl?: string, status?: TeamStatus) => {
    const color = getTeamColor(teamName);
    let statusHtml = '';
    if (status) {
        let statusColor = '#ef4444'; // Red (Idle)
        let animation = '';
        if (status === 'solving') statusColor = '#eab308'; // Yellow
        else if (status === 'moving') {
            statusColor = '#22c55e'; // Green
            animation = 'animation: pulse 1.5s infinite;';
        }
        statusHtml = `<div style="position: absolute; top: -5px; right: -5px; width: 16px; height: 16px; background-color: ${statusColor}; border: 2px solid white; border-radius: 50%; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.3); ${animation}"></div>`;
    }
    const pinHtml = `
      <div style="position: relative; width: 60px; height: 60px; display: flex; flex-col; align-items: center; justify-content: center;">
        <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 900; white-space: nowrap; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); z-index: 20;">${teamName}</div>
        <div style="position: absolute; bottom: 0; width: 30px; height: 10px; background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(4px); transform: translateY(5px);"></div>
        <div style="width: 50px; height: 50px; background: white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 2px 2px 10px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; border: 2px solid white;">
          <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; transform: rotate(45deg); background-color: ${color}; display: flex; align-items: center; justify-content: center; position: relative;">
            ${photoUrl ? `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="font-weight: 900; font-size: 16px; color: white; text-transform: uppercase;">${teamName.substring(0, 2)}</div>`}
          </div>
        </div>
        ${statusHtml}
      </div>
      <style>@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }</style>
    `;
    return L.divIcon({ className: 'custom-team-pin', html: pinHtml, iconSize: [60, 60], iconAnchor: [30, 56], popupAnchor: [0, -60] });
};

// Simplified icon for team members viewed by captain
const createTeammateIcon = (memberName: string) => {
    return L.divIcon({
        className: 'custom-teammate-icon',
        html: `<div style="width: 30px; height: 30px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${memberName.substring(0, 1)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
};

export interface GameMapHandle {
  fitBounds: (points: GamePoint[] | Coordinate[]) => void;
  getBounds: () => { ne: Coordinate; sw: Coordinate } | null;
  getCenter: () => Coordinate;
  jumpTo: (coord: Coordinate, zoom?: number) => void;
}

interface GameMapProps {
  userLocation?: Coordinate | null; // Keep optional prop for manual overrides (Editor)
  points: GamePoint[];
  teams?: { team: Team, location: Coordinate, status?: TeamStatus, stats?: any }[];
  teamTrails?: Record<string, Coordinate[]>;
  pointLabels?: Record<string, string>;
  measurePath?: Coordinate[];
  measuredDistance?: number; // Distance in meters for measure mode
  logicLinks?: any[];
  playgroundMarkers?: any[];
  dangerZones?: DangerZone[];
  routes?: GameRoute[];
  dependentPointIds?: string[];
  accuracy?: number | null; // Keep optional prop
  mode: GameMode;
  mapStyle: MapStyleId;
  selectedPointId?: string | null;
  isRelocating?: boolean;
  isMeasuring?: boolean; // NEW: Measure mode flag to prevent task modals
  relocateScopeCenter?: Coordinate | null; // Center point when relocating all tasks
  relocateAllTaskIds?: string[]; // Task IDs selected for relocation
  onPointClick: (point: GamePoint) => void;
  onTeamClick?: (teamId: string) => void;
  onMapClick?: (coord: Coordinate) => void;
  onPointMove?: (pointId: string, newLoc: Coordinate) => void;
  onDeletePoint?: (pointId: string) => void;
  onDragStart?: (pointId: string) => void;
  onPointHover?: (point: GamePoint | null) => void;
  showScores?: boolean;
  showTaskId?: boolean;
  showTaskTitle?: boolean;
  onZoneClick?: (zone: DangerZone) => void;
  onZoneMove?: (zoneId: string, newLoc: Coordinate) => void; // NEW: For dragging danger zones
  hoveredPointId?: string | null; // NEW: Point being hovered in list
  hoveredDangerZoneId?: string | null; // NEW: Danger zone being hovered in list
  gameEnded?: boolean; // New prop
  returnPath?: Coordinate[]; // New prop for return line
  showUserLocation?: boolean; // New prop for user location visibility
}

// Internal component to handle user location updates without re-rendering the whole map
const UserLocationMarker = ({ overrideLocation, overrideAccuracy, visible = true }: { overrideLocation?: Coordinate | null, overrideAccuracy?: number | null, visible?: boolean }) => {
    const { userLocation: ctxLocation, gpsAccuracy: ctxAccuracy } = useLocation();
    
    // Prefer props (for testing/instructor mode), fall back to context
    const location = overrideLocation || ctxLocation;
    const accuracy = overrideAccuracy || ctxAccuracy;

    if (!visible || !location) return null;

    return (
        <>
            <Marker position={[location.lat, location.lng]} icon={UserIcon} zIndexOffset={500} />
            {accuracy !== null && (
                <Circle 
                    center={[location.lat, location.lng]} 
                    radius={accuracy} 
                    pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, color: '#3b82f6', weight: 1, dashArray: '5, 5', interactive: false }} 
                />
            )}
        </>
    );
};

const MapClickParams = ({ onClick }: { onClick?: (c: Coordinate) => void }) => {
  useMapEvents({ click(e) { if (onClick) onClick(e.latlng); } });
  return null;
};

const RecenterMap = ({ center, points, mode }: { center: Coordinate | null, points: GamePoint[], mode: GameMode }) => {
  const map = useMap();
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && points.length > 0) {
        const validPoints = points.filter(p => isValidCoordinate(p.location));
        if (validPoints.length > 0) {
            const latLngs = validPoints.map(p => [p.location.lat, p.location.lng] as [number, number]);
            const bounds = L.latLngBounds(latLngs);
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], animate: false, maxZoom: 17 });
                initializedRef.current = true;
                return;
            }
        }
    }
    if (!initializedRef.current && center && isValidCoordinate(center)) {
      map.setView([center.lat, center.lng], 16);
      initializedRef.current = true;
    }
  }, [center, points, mode, map]);
  return null;
};

const MapController = ({ handleRef }: { handleRef: React.RefObject<any> }) => {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
        const t = setTimeout(() => map.invalidateSize(), 200);
        return () => clearTimeout(t);
    }, [map]);
    useImperativeHandle(handleRef, () => ({
        fitBounds: (pts: GamePoint[] | Coordinate[]) => {
            console.log('[GameMap] fitBounds called with:', pts?.length, 'items');

            let latLngs: L.LatLngExpression[] = [];
            if (pts && pts.length > 0 && 'location' in pts[0]) {
                 const validPts = (pts as GamePoint[]).filter(p => isValidCoordinate(p.location));
                 console.log('[GameMap] Filtered to', validPts.length, 'valid GamePoints from', pts.length);
                 latLngs = validPts.map(p => [p.location.lat, p.location.lng]);
            } else if (pts && pts.length > 0) {
                 const validCoords = (pts as Coordinate[]).filter(c => isValidCoordinate(c));
                 console.log('[GameMap] Filtered to', validCoords.length, 'valid Coordinates from', pts.length);
                 latLngs = validCoords.map(c => [c.lat, c.lng]);
            }

            console.log('[GameMap] latLngs to fit:', latLngs);

            if (latLngs.length === 0) {
                console.warn('[GameMap] fitBounds: No valid coordinates to fit');
                return;
            }

            const bounds = L.latLngBounds(latLngs);
            console.log('[GameMap] Calculated bounds:', bounds.toBBoxString());

            if (bounds.isValid()) {
                console.log('[GameMap] Fitting bounds to', latLngs.length, 'points with maxZoom 16');
                // Use same zoom settings as initial fit: padding: [50, 50], animate: false, maxZoom: 16
                map.fitBounds(bounds, { padding: [50, 50], animate: false, maxZoom: 17 });
            } else {
                console.warn('[GameMap] Invalid bounds calculated');
            }
        },
        getBounds: () => {
            const b = map.getBounds();
            return { ne: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng }, sw: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng } };
        },
        getCenter: () => { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
        jumpTo: (coord: Coordinate, zoom: number = 17) => {
            if (!isValidCoordinate(coord)) {
                console.warn('[GameMap] Invalid coordinate for jumpTo:', coord);
                return;
            }
            map.flyTo([coord.lat, coord.lng], zoom, { duration: 1.5 });
        }
    }));
    return null;
};

const MAP_LAYERS: Record<string, { url: string; attribution: string, className?: string, errorTileUrl?: string }> = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
  dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CartoDB' },
  ancient: { url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', attribution: '&copy; Stamen Design' },
  clean: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; CartoDB' },
  // Updated: Winter now uses OSM with a cold CSS filter for reliability
  winter: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', className: 'map-filter-winter' },
  // Updated: Ski uses OpenSkiMap but falls back gracefully if down
  ski: { url: 'https://tiles.openskimap.org/map/{z}/{x}/{y}.png', attribution: '&copy; OpenSkiMap' },
  // Norwegian: Nordic cross-country ski trails from OpenSkiMap with enhanced saturation
  norwegian: { url: 'https://tiles.openskimap.org/map/{z}/{x}/{y}.png', attribution: '&copy; OpenSkiMap, OpenStreetMap contributors, Norwegian Mapping Authority', className: 'map-filter-nordic' },
  // Historic: Using OSM as base but we will apply CSS sepia filter in component
  historic: { url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', className: 'map-filter-historic' },
  // Google Custom placeholder - uses dark by default but allows saving custom JSON
  google_custom: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; CartoDB' }
};

const MapLayers: React.FC<{ mapStyle: string }> = React.memo(({ mapStyle }) => {
  if (mapStyle === 'none') {
      return null; // Return nothing so no tiles are rendered
  }

  const layer = MAP_LAYERS[mapStyle] || MAP_LAYERS.osm;
  
  return (
    <>
      <TileLayer 
        url={layer.url} 
        attribution={layer.attribution} 
        className={layer.className || ''}
      />
      
      {/* Historic Filter CSS Injection */}
      {mapStyle === 'historic' && (
          <>
            <style>{`
                .map-filter-historic {
                    filter: sepia(0.6) contrast(1.1) brightness(0.9) hue-rotate(-15deg) !important;
                }
            `}</style>
            {/* Paper Texture Overlay */}
            <div className="absolute inset-0 z-[5] pointer-events-none opacity-20 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]"></div>
          </>
      )}

      {/* Winter Filter CSS Injection */}
      {mapStyle === 'winter' && (
          <style>{`
              .map-filter-winter {
                  filter: brightness(1.2) hue-rotate(180deg) saturate(0.5) !important;
              }
          `}</style>
      )}

      {/* Nordic Filter CSS Injection */}
      {mapStyle === 'norwegian' && (
          <style>{`
              .map-filter-nordic {
                  filter: saturate(1.15) brightness(1.08) contrast(1.05) !important;
              }
          `}</style>
      )}
    </>
  );
});

// Task Marker Component
const MapTaskMarker = React.memo(({ point, mode, label, showScore, isRelocateSelected, isHovered, isMeasuring, isRelocating, onClick, onMove, onDelete, onDragStart, onDragEnd, onHover }: any) => {
    const isUnlocked = point.isUnlocked || mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR;
    const isCompleted = point.isCompleted;

    // Draggable in Edit & Instructor Mode (only when parent provides onMove handler)
    // CRITICAL: Disable dragging in relocate mode, but ALLOW in measure mode
    const draggable = (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && !!onMove && !isRelocating;

    const eventHandlers = React.useMemo(
        () => ({
            click: (e: any) => {
                // CRITICAL: When tools are active, always call onClick
                // The onClick handler (handlePointClick in App.tsx) will handle the tool logic
                console.log('[MapTaskMarker] Click event:', {
                    pointId: point.id,
                    isMeasuring,
                    isRelocating,
                    mode
                });
                onClick(point);
            },
            mouseover: () => {
                if (onHover) onHover(point);
            },
            mouseout: () => {
                if (onHover) onHover(null);
            },
            dragstart(e: any) {
                // Prevent drag when in relocate mode (measure mode is OK)
                if (isRelocating) {
                    console.log('[MapTaskMarker] Drag prevented - relocate mode active');
                    e.originalEvent?.preventDefault();
                    e.originalEvent?.stopPropagation();
                    return;
                }
                if (onDragStart) onDragStart(point.id);
            },
            dragend(e: any) {
                const shouldDelete = onDragEnd ? onDragEnd(point.id, e) : false;
                // If onDragEnd returns true, it means delete - don't move
                if (shouldDelete === true) {
                    // Reset marker position to original
                    e.target.setLatLng([point.location.lat, point.location.lng]);
                    return;
                }
                // Otherwise move the marker
                if (onMove) {
                    const latlng = e.target.getLatLng();
                    onMove(point.id, { lat: latlng.lat, lng: latlng.lng });
                }
            },
        }),
        [point, onClick, onMove, onDragStart, onDragEnd, onHover, isMeasuring, isRelocating, mode]
    );

    const icon = getLeafletIcon(
        point.iconId,
        isUnlocked,
        isCompleted,
        label,
        (point.logic?.onOpen?.length || point.logic?.onCorrect?.length || point.logic?.onIncorrect?.length) && mode === GameMode.EDIT,
        point.areaColor, // New: Override color if zone color set
        mode === GameMode.EDIT && point.isHiddenBeforeScan,
        showScore ? point.points : undefined,
        point.iconUrl
    );

    // Only render markers for points with valid map locations (not playground-only points)
    if (!point.location || !Number.isFinite(point.location.lat) || !Number.isFinite(point.location.lng)) {
        return null;
    }

    return (
        <React.Fragment>
            <Marker
                position={[point.location.lat, point.location.lng]}
                icon={icon}
                eventHandlers={eventHandlers}
                draggable={draggable}
                zIndexOffset={isCompleted ? 0 : 100}
            >
            </Marker>

            {/* Relocate Selection Glow - Pulsing circle around selected tasks */}
            {isRelocateSelected && (
                <Circle
                    center={[point.location.lat, point.location.lng]}
                    radius={30}
                    pathOptions={{
                        color: '#f97316',
                        fillColor: '#f97316',
                        fillOpacity: 0.3,
                        weight: 3,
                        className: 'animate-pulse'
                    }}
                    interactive={false}
                />
            )}

            {/* Radius Circle - Enhanced when hovered from list */}
            {(mode === GameMode.EDIT || isUnlocked) && (
                <Circle
                    center={[point.location.lat, point.location.lng]}
                    radius={point.radiusMeters}
                    pathOptions={{
                        color: isHovered ? '#f97316' : (isCompleted ? '#22c55e' : (point.areaColor || (isUnlocked ? '#eab308' : '#3b82f6'))),
                        fillColor: isHovered ? '#f97316' : (isCompleted ? '#22c55e' : (point.areaColor || (isUnlocked ? '#eab308' : '#3b82f6'))),
                        fillOpacity: isHovered ? 0.3 : 0.1,
                        weight: isHovered ? 4 : 1,
                        dashArray: isCompleted ? undefined : '5, 10',
                        className: isHovered ? 'task-hover-pulse' : undefined
                    }}
                    interactive={true}
                    eventHandlers={{
                        mouseover: () => {
                            if (onHover) onHover(point);
                        },
                        mouseout: () => {
                            if (onHover) onHover(null);
                        }
                    }}
                />
            )}

            {/* Extra glow ring when hovered */}
            {isHovered && (
                <Circle
                    center={[point.location.lat, point.location.lng]}
                    radius={point.radiusMeters * 1.5}
                    pathOptions={{
                        color: '#f97316',
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        weight: 2,
                        className: 'animate-pulse'
                    }}
                    interactive={false}
                />
            )}

            {/* CSS for hover pulse animation */}
            {isHovered && (
                <style>{`
                    @keyframes task-hover-pulse {
                        0%, 100% { opacity: 0.8; }
                        50% { opacity: 1; }
                    }
                    .task-hover-pulse {
                        animation: task-hover-pulse 1s ease-in-out infinite;
                    }
                `}</style>
            )}
        </React.Fragment>
    );
}, (prev, next) => {
    // Both points have no location (playground-only)
    if (!prev.point.location && !next.point.location) {
        return true; // Considered "equal" for memo purposes
    }
    // One has location, other doesn't
    if (!prev.point.location || !next.point.location) {
        return false; // Need to re-render if location status changed
    }
    // Both have locations, compare them
    return prev.point.id === next.point.id &&
           prev.point.location.lat === next.point.location.lat &&
           prev.point.location.lng === next.point.location.lng &&
           prev.point.isUnlocked === next.point.isUnlocked &&
           prev.point.isCompleted === next.point.isCompleted &&
           prev.mode === next.mode &&
           prev.label === next.label && // CRITICAL: Include label to detect reorder changes
           prev.showScore === next.showScore &&
           prev.point.isHiddenBeforeScan === next.point.isHiddenBeforeScan &&
           prev.point.iconId === next.point.iconId &&
           prev.point.iconUrl === next.point.iconUrl &&
           prev.point.radiusMeters === next.point.radiusMeters &&
           prev.point.areaColor === next.point.areaColor &&
           prev.isRelocateSelected === next.isRelocateSelected &&
           prev.isHovered === next.isHovered && // CRITICAL: Re-render when hover state changes
           prev.isMeasuring === next.isMeasuring && // CRITICAL: Re-render when measure mode changes
           prev.isRelocating === next.isRelocating; // CRITICAL: Re-render when relocate mode changes
});

const DangerZoneMarker = React.memo(({ zone, onClick, onMove, mode, isHovered }: any) => {
    const draggable = mode === GameMode.EDIT && !!onMove;

    const dangerIcon = L.divIcon({
        className: 'custom-danger-icon',
        html: `<div style="width: 32px; height: 32px; background-color: #ef4444; border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5); cursor: ${draggable ? 'move' : 'pointer'};">⚠</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    return (
        <React.Fragment>
            {/* Danger Zone Circle with slow glow */}
            <Circle
                center={[zone.location.lat, zone.location.lng]}
                radius={zone.radius}
                pathOptions={{
                    color: isHovered ? '#ff0000' : '#ef4444',
                    fillColor: isHovered ? '#ff0000' : '#ef4444',
                    fillOpacity: isHovered ? 0.3 : 0.2,
                    weight: isHovered ? 3 : 2,
                    dashArray: '10, 10'
                }}
                interactive={false}
                className="danger-zone-glow"
            />

            {/* CSS for slow glow animation */}
            <style>{`
                @keyframes danger-glow {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                .danger-zone-glow {
                    animation: danger-glow 3s ease-in-out infinite;
                }
            `}</style>

            {/* Draggable Center Marker */}
            {mode === GameMode.EDIT && (
                <Marker
                    position={[zone.location.lat, zone.location.lng]}
                    icon={dangerIcon}
                    draggable={draggable}
                    eventHandlers={{
                        click: () => onClick && onClick(zone),
                        dragend(e: any) {
                            if (onMove) {
                                const latlng = e.target.getLatLng();
                                onMove(zone.id, { lat: latlng.lat, lng: latlng.lng });
                            }
                        }
                    }}
                    zIndexOffset={200}
                >
                    <Tooltip permanent direction="top" offset={[0, -20]} className="custom-leaflet-tooltip font-bold text-xs text-red-500 bg-white px-2 py-1 rounded shadow-lg">
                        {zone.title || 'DANGER ZONE'}
                    </Tooltip>
                </Marker>
            )}
        </React.Fragment>
    );
});

// WRAP GAME MAP IN MEMO TO PREVENT RE-RENDERS
const GameMap = React.memo(forwardRef<GameMapHandle, GameMapProps>(({
    userLocation: propLocation,
    points = [],
    teams = [],
    teamTrails = {},
    pointLabels = {},
    measurePath = [],
    logicLinks = [],
    playgroundMarkers = [],
    dangerZones = [],
    routes = [],
    dependentPointIds = [],
    accuracy: propAccuracy,
    mode,
    mapStyle,
    selectedPointId,
    isRelocating,
    isMeasuring,
    relocateScopeCenter,
    relocateAllTaskIds = [],
    onPointClick,
    onTeamClick,
    onMapClick,
    onPointMove,
    onDeletePoint,
    onDragStart,
    onPointHover,
    showScores,
    showTaskId,
    showTaskTitle,
    measuredDistance = 0,
    onZoneClick,
    onZoneMove,
    hoveredPointId,
    hoveredDangerZoneId,
    gameEnded = false, // Destructure new prop
    returnPath,
    showUserLocation = true // Default true
}, ref) => {
  // NOTE: We do NOT consume useLocation() here directly to avoid re-rendering the entire MapContainer.
  // Instead, we use the UserLocationMarker child component for the live dot.
  // propLocation is used for "Center" logic only initially or if provided (instructor mode).
  
  const center = propLocation || { lat: 55.6761, lng: 12.5683 };
  const [highlightedRouteId, setHighlightedRouteId] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);

  // Filter logic for Game Ended state
  const mapPoints = points.filter(p => {
      if (p.isSectionHeader || p.playgroundId) return false;

      // If game ended, only show Info points (points == 0) or if explicitly flagged (if we add 'isInfo' later)
      // Assuming 0 points means 'Info'
      if (gameEnded) {
          // Keep info points (0 pts) or Completed tasks? Prompt says "all info points should be visible",
          // "all remaining tasks hidden". Let's assume info points are visible.
          // Completed tasks might be useful to see what you did, but "hidden" implies gone.
          // Let's hide everything > 0 points unless completed?
          // The prompt says "all remaning tasks are hidden". This implies uncompleted tasks are hidden.
          if (!p.isCompleted && p.points > 0) return false;
      }

      if (mode === GameMode.PLAY && p.isHiddenBeforeScan && !p.isUnlocked) {
          return false;
      }
      return true;
  });
  
  const getLabel = (point: GamePoint) => {
      if (pointLabels && pointLabels[point.id]) return pointLabels[point.id];

      // In EDIT mode, build label based on showTaskId and showTaskTitle flags
      if (mode === GameMode.EDIT) {
          const taskIndex = points.findIndex(p => p.id === point.id) + 1;
          const taskOrder = taskIndex.toString().padStart(3, '0');

          const labelParts = [];

          // Add order ID if enabled
          if (showTaskId) {
              labelParts.push(taskOrder);
          }

          // Add title if enabled
          if (showTaskTitle && point.title) {
              labelParts.push(point.title);
          }

          // Return combined label or undefined if both are false
          return labelParts.length > 0 ? labelParts.join(' - ') : undefined;
      }

      return undefined;
  };

  return (
    <div className="relative w-full h-full z-0 bg-slate-900">
        {isRelocating && (
            <div className="absolute inset-0 pointer-events-none z-[5000] flex items-center justify-center">
                <div className="relative">
                    <Crosshair className="w-12 h-12 text-green-500 opacity-80" strokeWidth={2} />
                    <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-green-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
                </div>
            </div>
        )}

        {mapStyle === 'none' && (
            <div className="absolute inset-0 z-[0] bg-[#1a1a1a]">
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:40px_40px]"></div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-white/5 font-black uppercase text-6xl tracking-[0.2em] select-none">BLANK MAP</span>
                </div>
            </div>
        )}

        <MapContainer 
            center={[center.lat, center.lng]} 
            zoom={15} 
            style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }} 
            zoomControl={false}
        >
            <MapController handleRef={ref as any} />
            <MapLayers key={mapStyle} mapStyle={mapStyle} />
            <RecenterMap center={propLocation} points={mapPoints} mode={mode} />
            {onMapClick && <MapClickParams onClick={onMapClick} />}
            
            {/* Routes */}
            {routes.map(route => {
                if (!route.isVisible) return null;
                const isHighlighted = highlightedRouteId === route.id;
                return (
                    <Polyline 
                        key={route.id}
                        positions={route.points.map(p => [p.lat, p.lng])}
                        pathOptions={{ color: isHighlighted ? '#f97316' : route.color, weight: isHighlighted ? 8 : 4, opacity: isHighlighted ? 1 : 0.7, interactive: true }}
                        eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setHighlightedRouteId(isHighlighted ? null : route.id); }}}
                    />
                );
            })}

            {/* LIVE USER MARKER (Internal Context Consumer) */}
            <UserLocationMarker overrideLocation={propLocation} overrideAccuracy={propAccuracy} visible={showUserLocation} />
            
            {/* Return Path (Game Ended) */}
            {gameEnded && returnPath && returnPath.length > 1 && (
                <Polyline 
                    positions={returnPath.map(c => [c.lat, c.lng])}
                    pathOptions={{ color: '#22c55e', weight: 6, dashArray: '10, 15', className: 'animate-pulse' }}
                />
            )}
            
            {/* Logic Links (Instructor/Edit) */}
            {logicLinks.map((link, i) => (
                <Polyline 
                    key={i} 
                    positions={[link.from, link.to]} 
                    pathOptions={{ color: link.color, weight: 2, dashArray: '5, 10', opacity: 0.6 }} 
                />
            ))}

            {/* Measure Path with Orange Line - Box is now draggable in App.tsx */}
            {measurePath.length > 1 && (
                <Polyline positions={measurePath} pathOptions={{ color: '#f97316', dashArray: '10, 10', weight: 4 }} />
            )}

            {/* Danger Zones */}
            {dangerZones.map(zone => (
                <DangerZoneMarker
                    key={zone.id}
                    zone={zone}
                    onClick={onZoneClick}
                    onMove={onZoneMove}
                    mode={mode}
                    isHovered={hoveredDangerZoneId === zone.id}
                />
            ))}

            {/* Relocate Scope Center */}
            {isRelocating && relocateScopeCenter && (
                <>
                    <Circle
                        center={[relocateScopeCenter.lat, relocateScopeCenter.lng]}
                        radius={200}
                        pathOptions={{
                            color: '#22c55e',
                            fillColor: '#22c55e',
                            fillOpacity: 0.1,
                            weight: 3,
                            dashArray: '5, 10',
                            className: 'animate-pulse'
                        }}
                        interactive={false}
                    />
                    <Marker
                        position={[relocateScopeCenter.lat, relocateScopeCenter.lng]}
                        icon={L.icon({
                            iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2322c55e" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16],
                            className: 'animate-bounce'
                        })}
                        zIndexOffset={1500}
                    />
                </>
            )}

            {/* Tasks */}
            {mapPoints.map(point => (
                <MapTaskMarker
                    key={point.id}
                    point={point}
                    mode={mode}
                    label={getLabel(point)}
                    showScore={showScores}
                    isRelocateSelected={relocateAllTaskIds.includes(point.id)}
                    isHovered={hoveredPointId === point.id}
                    isMeasuring={isMeasuring}
                    isRelocating={isRelocating}
                    onClick={onPointClick}
                    onMove={onPointMove}
                    onDelete={onDeletePoint}
                    onHover={onPointHover}
                    onDragStart={(id: string) => {
                        console.log('[Drag] Started dragging point:', id);
                        setDraggingPointId(id);
                    }}
                    onDragEnd={(id: string, e: any) => {
                        const trashEl = document.getElementById('map-trash-bin');
                        const trashRect = trashEl?.getBoundingClientRect();

                        let overTrash = false;

                        if (trashRect) {
                            const originalEvent = e?.originalEvent;
                            const touchPoint = originalEvent?.changedTouches?.[0] || originalEvent?.touches?.[0];

                            const clientX = typeof originalEvent?.clientX === 'number' ? originalEvent.clientX : (typeof touchPoint?.clientX === 'number' ? touchPoint.clientX : null);
                            const clientY = typeof originalEvent?.clientY === 'number' ? originalEvent.clientY : (typeof touchPoint?.clientY === 'number' ? touchPoint.clientY : null);

                            if (typeof clientX === 'number' && typeof clientY === 'number') {
                                overTrash = clientX >= trashRect.left && clientX <= trashRect.right && clientY >= trashRect.top && clientY <= trashRect.bottom;
                            } else {
                                const markerEl = typeof e?.target?.getElement === 'function' ? e.target.getElement() : null;
                                const markerRect = markerEl?.getBoundingClientRect();
                                if (markerRect) {
                                    overTrash = !(
                                        markerRect.right < trashRect.left ||
                                        markerRect.left > trashRect.right ||
                                        markerRect.bottom < trashRect.top ||
                                        markerRect.top > trashRect.bottom
                                    );
                                }
                            }
                        }

                        console.log('[Drag] Ended drag for point:', id, 'overTrash:', overTrash, 'isOverTrash(state):', isOverTrash);
                        setDraggingPointId(null);

                        if (overTrash && onDeletePoint) {
                            console.log('[Drag] Calling delete for:', id);
                            onDeletePoint(id);
                            setIsOverTrash(false);
                            return true; // Signal deletion
                        }

                        setIsOverTrash(false);
                        return false;
                    }}
                />
            ))}

            {/* Teams (Instructor Mode OR Captain View of Teammates) */}
            {teams && teams.map((t) => {
                // If it's a "teammate" view (GameMode.PLAY for captain), use simpler icon
                if (mode === GameMode.PLAY && t.team.id === 'teammates') {
                    return (
                        <Marker 
                            key={`tm-${t.team.name}`} 
                            position={[t.location.lat, t.location.lng]} 
                            icon={createTeammateIcon(t.team.name)} 
                            zIndexOffset={900}
                        >
                            <Tooltip direction="top" offset={[0, -15]} opacity={1}>
                                <span className="font-bold text-xs">{t.team.name}</span>
                            </Tooltip>
                        </Marker>
                    );
                }

                // Instructor View
                return (
                    <Marker 
                        key={t.team.id} 
                        position={[t.location.lat, t.location.lng]} 
                        icon={createTeamIcon(t.team.name, t.team.photoUrl, t.status)} 
                        zIndexOffset={1000}
                        eventHandlers={{ click: () => onTeamClick && onTeamClick(t.team.id) }}
                    >
                        {mode === GameMode.INSTRUCTOR && (
                            <Tooltip direction="top" offset={[0, -40]} opacity={1} permanent>
                                <div className="text-center">
                                    <div className="font-black uppercase text-xs">{t.team.name}</div>
                                    {t.stats && <div className="text-[9px] font-bold text-green-600">{t.stats.mapSolved}/{t.stats.mapTotal}</div>}
                                </div>
                            </Tooltip>
                        )}
                    </Marker>
                );
            })}

            {/* Team Trails */}
            {Object.keys(teamTrails).map(teamId => (
                <Polyline 
                    key={teamId} 
                    positions={teamTrails[teamId]} 
                    pathOptions={{ color: getTeamColor(teamId), weight: 3, opacity: 0.5, dashArray: '2, 8' }} 
                />
            ))}

        </MapContainer>

        {/* Visual Trash Bin - Editor Mode Only */}
        {mode === GameMode.EDIT && (
            <div
                id="map-trash-bin"
                className="absolute bottom-6 right-6 z-[1000] pointer-events-auto"
                onMouseEnter={() => {
                    if (draggingPointId) {
                        console.log('[Trash] Entered trash zone with point:', draggingPointId);
                        setIsOverTrash(true);
                    }
                }}
                onMouseLeave={() => {
                    console.log('[Trash] Left trash zone');
                    setIsOverTrash(false);
                }}
            >
                <div className={`border-2 p-4 rounded-2xl shadow-xl transition-all ${
                    isOverTrash
                        ? 'bg-red-600 border-red-500 text-white scale-125 animate-pulse shadow-red-500/50'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-red-600 hover:text-red-500 hover:bg-slate-800'
                }`}>
                    <div className="flex flex-col items-center gap-2">
                        <Trash2 className={`w-8 h-8 ${isOverTrash ? 'animate-bounce' : 'group-hover:animate-bounce'}`} />
                        <div className="text-[10px] font-black uppercase tracking-wider text-center" dangerouslySetInnerHTML={{
                            __html: isOverTrash ? 'DROP TO<br/>DELETE!' : 'Drag<br/>Tasks<br/>Here'
                        }} />
                    </div>
                    {!isOverTrash && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            ✕
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}));

export default GameMap;
