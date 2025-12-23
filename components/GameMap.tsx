
import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { GamePoint, Coordinate, GameMode, MapStyleId, Team } from '../types';
import { getLeafletIcon } from '../utils/icons';
import { Trash2, Crosshair, EyeOff, Image as ImageIcon, CheckCircle, HelpCircle, Zap } from 'lucide-react';

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
  logicLinks?: { from: Coordinate; to: Coordinate; color?: string; type?: 'onOpen' | 'onCorrect' | 'onIncorrect' | 'open_playground' }[]; 
  playgroundMarkers?: { id: string; location: Coordinate; title: string; iconId: string }[]; 
  dependentPointIds?: string[]; 
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
  showScores?: boolean;
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

    if ((mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && points.length > 0) {
        const validPoints = points.filter(p => p.location.lat !== 0 || p.location.lng !== 0);
        
        if (validPoints.length > 0) {
            const latLngs = validPoints.map(p => [p.location.lat, p.location.lng] as [number, number]);
            const bounds = L.latLngBounds(latLngs);
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], animate: false, maxZoom: 16 });
                initializedRef.current = true;
                return;
            }
        }
    }

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
            const validPts = pts.filter(p => p.location.lat !== 0 || p.location.lng !== 0);
            
            if (validPts.length === 0) return;
            
            const bounds = L.latLngBounds(validPts.map(p => [p.location.lat, p.location.lng]));
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
            }
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
  isDependent: boolean;
  isRelocating?: boolean;
  label?: string;
  onClick: (p: GamePoint) => void;
  onMove?: (id: string, loc: Coordinate) => void;
  onDelete?: (id: string) => void;
  onHover?: (p: GamePoint | null) => void;
  showScore?: boolean;
}

const MapTaskMarker: React.FC<MapTaskMarkerProps> = ({ 
  point, 
  mode, 
  isSelected,
  isDependent,
  isRelocating,
  label,
  onClick, 
  onMove, 
  onDelete,
  onHover,
  showScore
}) => {
  
  const markerRef = useRef<L.Marker>(null);
  const circleRef = useRef<L.Circle>(null);
  const isDraggingRef = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const map = useMap(); 
  
  const isDraggable = (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && !isRelocating;
  const showGeofence = (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && !isRelocating;

  const hasActions = (point.logic?.onOpen?.length || 0) > 0 || 
                     (point.logic?.onCorrect?.length || 0) > 0 || 
                     (point.logic?.onIncorrect?.length || 0) > 0;

  // Determine if this task opens a playground
  const isPlaygroundActivator = (point.logic?.onOpen?.some(a => a.type === 'open_playground') || 
                                 point.logic?.onCorrect?.some(a => a.type === 'open_playground') ||
                                 point.logic?.onIncorrect?.some(a => a.type === 'open_playground')) &&
                                 (mode === GameMode.EDIT); // Only verify activation glow in Edit mode for clarity

  const visualIsUnlocked = mode === GameMode.INSTRUCTOR ? true : point.isUnlocked;
  const visualIsCompleted = mode === GameMode.INSTRUCTOR ? false : point.isCompleted;
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
          if (onMove) {
              const ll = marker.getLatLng();
              onMove(point.id, { lat: ll.lat, lng: ll.lng });
          }
        }
      },
    }),
    [point, onClick, onMove, onDelete, onHover, map, mode]
  );

  useEffect(() => {
      const marker = markerRef.current;
      if (marker) {
          let targetOpacity = 1;
          if (isRelocating) targetOpacity = 0.4;
          else if (isDependent && mode === GameMode.EDIT) targetOpacity = 0.6;
          else if (isDraggable) targetOpacity = 0.9;

          marker.setOpacity(targetOpacity);
          marker.setZIndexOffset(isSelected ? 1000 : (isDraggable ? 500 : 0));
          
          if (marker.getElement()) {
              if (isDependent && mode === GameMode.EDIT) {
                  marker.getElement()!.style.filter = 'grayscale(100%)';
              } else {
                  marker.getElement()!.style.filter = 'none';
              }
          }

          if (marker.dragging) isDraggable ? marker.dragging.enable() : marker.dragging.disable();
      }
  }, [isSelected, isDraggable, isRelocating, isDependent, mode]);

  const defaultStatusColor = visualIsCompleted ? '#22c55e' : (visualIsUnlocked ? '#eab308' : '#ef4444');
  const strokeColor = isSelected ? '#4f46e5' : (forcedColor || defaultStatusColor);
  const fillColor = point.areaColor || strokeColor;

  const stripHtml = (html: any) => typeof html === 'string' ? html.replace(/<[^>]*>?/gm, '') : '';
  const questionText = stripHtml(point.task.question);
  const isOptionsType = ['multiple_choice', 'checkbox', 'dropdown', 'multi_select_dropdown'].includes(point.task.type);

  return (
    <>
      <Marker 
        draggable={isDraggable} 
        eventHandlers={eventHandlers} 
        position={[point.location.lat, point.location.lng]} 
        icon={getLeafletIcon(
            point.iconId, 
            visualIsUnlocked, 
            visualIsCompleted, 
            label, 
            (hasActions || point.isHiddenBeforeScan) && (mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR), 
            forcedColor, 
            point.isHiddenBeforeScan,
            mode === GameMode.EDIT && showScore ? point.points : undefined, 
            point.iconUrl,
            isPlaygroundActivator
        )} 
        ref={markerRef} 
      >
        {(mode === GameMode.EDIT || mode === GameMode.INSTRUCTOR) && (
            <Tooltip direction="top" offset={[0, -45]} opacity={1} className="custom-leaflet-tooltip">
                <div className="relative bg-white dark:bg-gray-900 p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col gap-2 min-w-[200px] max-w-[260px]">
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-900 rotate-45 border-b border-r border-gray-200 dark:border-gray-700"></div>
                    <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800 relative z-10">
                        <span className="font-black text-xs uppercase text-gray-900 dark:text-white truncate max-w-[140px]">{point.title}</span>
                        {mode === GameMode.EDIT && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-gray-800 dark:bg-gray-700 text-white rounded font-black uppercase tracking-wider">{point.task.type}</span>
                        )}
                    </div>
                    {point.task.imageUrl && (
                        <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative border border-gray-100 dark:border-gray-700">
                            <img src={point.task.imageUrl} className="w-full h-full object-cover" alt="Task" />
                        </div>
                    )}
                    <div className="flex gap-2 items-start">
                        <HelpCircle className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                        <span className="text-[10px] leading-tight text-gray-600 dark:text-gray-300 font-medium whitespace-pre-wrap">
                            {questionText || "No question text"}
                        </span>
                    </div>
                    {isOptionsType && point.task.options && point.task.options.length > 0 ? (
                        <div className="flex flex-col gap-1 mt-1 border-t border-gray-100 dark:border-gray-800 pt-2">
                            {point.task.options.map((opt, i) => {
                                const isCorrect = (point.task.type === 'checkbox' || point.task.type === 'multi_select_dropdown') 
                                    ? point.task.correctAnswers?.includes(opt)
                                    : point.task.answer === opt;
                                return (
                                    <div key={i} className={`flex items-start gap-1.5 text-[9px] px-1.5 py-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold border border-green-200 dark:border-green-800/30' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {isCorrect ? <CheckCircle className="w-3 h-3 shrink-0 mt-[1px]" /> : <div className="w-3 h-3 shrink-0" />}
                                        <span className="leading-tight">{opt}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex gap-2 items-start bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800/30">
                            <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                            <span className="text-[10px] font-bold text-green-700 dark:text-green-300 leading-tight">
                                {point.task.type === 'slider' 
                                    ? `Target: ${point.task.range?.correctValue} (Range: ${point.task.range?.min}-${point.task.range?.max})`
                                    : (point.task.answer || "No answer set")
                                }
                            </span>
                        </div>
                    )}
                    {mode === GameMode.EDIT && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {point.isHiddenBeforeScan && (
                                <span className="text-[9px] font-black text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-purple-100 dark:border-purple-800">
                                    <EyeOff className="w-2.5 h-2.5" /> HIDDEN
                                </span>
                            )}
                            {hasActions && (
                                <span className="text-[9px] font-black text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-red-100 dark:border-red-800">
                                    <Zap className="w-2.5 h-2.5" /> LOGIC
                                </span>
                            )}
                            {isDependent && (
                                <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                    LOCKED
                                </span>
                            )}
                        </div>
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
            color: strokeColor, 
            fillColor: fillColor, 
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

const GameMap = forwardRef<GameMapHandle, GameMapProps>(({ userLocation, points, teams, teamTrails, pointLabels, measurePath, logicLinks, playgroundMarkers = [], dependentPointIds, accuracy, mode, mapStyle, selectedPointId, isRelocating, onPointClick, onTeamClick, onMapClick, onPointMove, onDeletePoint, onPointHover, showScores }, ref) => {
  const center = userLocation || { lat: 55.6761, lng: 12.5683 };
  const currentLayer = MAP_LAYERS[mapStyle] || MAP_LAYERS.osm;
  
  const mapPoints = points.filter(p => {
      if (p.isSectionHeader || p.playgroundId) return false;
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

  const measurePathKey = measurePath ? measurePath.map(p => `${p.lat},${p.lng}`).join('|') : 'empty';

  return (
    <div className="relative w-full h-full">
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
            
            {(mode === GameMode.EDIT) && <MapClickParams onClick={onMapClick} />}
            
            {userLocation && (
                <>
                <Marker position={[userLocation.lat, userLocation.lng]} icon={UserIcon} zIndexOffset={500} />
                {accuracy && <Circle center={[userLocation.lat, userLocation.lng]} radius={accuracy} pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.1, color: '#3b82f6', weight: 1 }} />}
                </>
            )}
            
            {logicLinks && logicLinks.map((link, idx) => {
                if (!link.from || !link.to || typeof link.from.lat !== 'number' || typeof link.to.lat !== 'number') return null;
                // FILTER: Do not show lines for open_playground to reduce clutter
                if (link.type === 'open_playground') return null;

                const key = `link-${link.from.lat.toFixed(5)}-${link.from.lng.toFixed(5)}-${link.to.lat.toFixed(5)}-${link.to.lng.toFixed(5)}-${link.color}-${link.type}`;
                const color = link.color || '#eab308';
                const dashArray = '10, 10'; 

                return (
                    <Polyline 
                        key={key}
                        positions={[[link.from.lat, link.from.lng], [link.to.lat, link.to.lng]]} 
                        pathOptions={{ 
                            color: color, 
                            weight: 3, 
                            dashArray: dashArray, 
                            opacity: 0.8 
                        }} 
                    />
                );
            })}

            {playgroundMarkers.map((pg) => (
                <Marker 
                    key={`pg-marker-${pg.id}`}
                    position={[pg.location.lat, pg.location.lng]}
                    icon={getLeafletIcon(
                        pg.iconId as any || 'default', 
                        true, 
                        false, 
                        undefined, 
                        false, 
                        '#3b82f6', 
                        false
                    )}
                    zIndexOffset={800}
                    draggable={mode === GameMode.EDIT}
                    eventHandlers={{
                        dragend: (e) => {
                            const marker = e.target as L.Marker;
                            if (onPointMove) {
                                const ll = marker.getLatLng();
                                onPointMove(pg.id, { lat: ll.lat, lng: ll.lng });
                            }
                        }
                    }}
                >
                    <Tooltip direction="bottom" offset={[0, 20]} opacity={1} permanent className="custom-leaflet-tooltip">
                        <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg border-2 border-white">
                            {pg.title}
                        </div>
                    </Tooltip>
                </Marker>
            ))}

            {measurePath && measurePath.length > 1 && (
                <Polyline 
                    key={measurePathKey}
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
            
            {mapPoints.map(point => (
                <MapTaskMarker 
                    key={point.id} 
                    point={point} 
                    mode={mode} 
                    isRelocating={isRelocating} 
                    isSelected={selectedPointId === point.id} 
                    isDependent={!!(dependentPointIds && dependentPointIds.includes(point.id))}
                    label={getLabel(point)} 
                    onClick={onPointClick} 
                    onMove={onPointMove} 
                    onDelete={onDeletePoint} 
                    onPointHover={onPointHover} 
                    showScore={showScores}
                />
            ))}
        </MapContainer>
        {mode === GameMode.EDIT && !isRelocating && (
            <div id="map-trash-bin" className="absolute bottom-6 right-4 z-[2000] shadow-xl rounded-full p-3 transition-all border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-200 pointer-events-auto flex items-center justify-center w-14 h-14" title="Drag task here to delete"><Trash2 className="w-6 h-6 pointer-events-none" /></div>
        )}
    </div>
  );
});

export default GameMap;
