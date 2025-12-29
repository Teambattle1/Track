import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GamePoint, TaskList, Coordinate, Game, GameMode, GameRoute } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { X, MousePointerClick, GripVertical, Edit2, Eraser, Save, Check, ChevronDown, Plus, Library, Trash2, Eye, Filter, ChevronRight, ChevronLeft, Maximize, Gamepad2, AlertCircle, LayoutGrid, LayoutList, Map, Wand2, ToggleLeft, ToggleRight, Radio, FilePlus, RefreshCw, Users, Shield, Route, Upload, EyeOff, Hash, PlayCircle } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as db from '../services/db';
import { parseGPX } from '../utils/gpx';

interface EditorDrawerProps {
  onClose: () => void;
  activeGame?: Game | null;
  activeGameName: string;
  points: GamePoint[];
  allPoints?: GamePoint[]; 
  games: Game[];
  onSelectGame: (id: string) => void;
  onOpenGameChooser: () => void;
  filterState?: { mode: 'ALL' | 'TAG' | 'LIST'; value: string };
  onSetFilter?: (filter: { mode: 'ALL' | 'TAG' | 'LIST'; value: string }) => void;
  taskLists: TaskList[];
  sourceListId: string;
  selectedPointId?: string;
  onSetSourceListId: (id: string) => void;
  onEditPoint: (point: GamePoint) => void;
  onSelectPoint: (point: GamePoint) => void;
  onDeletePoint: (pointId: string) => void; 
  onReorderPoints: (points: GamePoint[]) => void;
  onClearMap: (idsToDelete?: string[]) => void;
  onSaveGame: () => void;
  onOpenTaskMaster: () => void;
  onSearchLocation?: (coord: Coordinate) => void;
  userLocation?: Coordinate | null;
  onFitBounds: (coords?: Coordinate[]) => void; // Updated signature
  onHoverPoint?: (point: GamePoint | null) => void;
  onHoverDangerZone?: (zoneId: string | null) => void;
  mapHoveredPointId?: string | null; // NEW: Point being hovered on map (reverse highlight)
  onOpenPlaygroundEditor?: (playgroundId?: string) => void;
  initialExpanded?: boolean;
  onAddTask?: (type: 'MANUAL' | 'AI' | 'LIBRARY' | 'TASKLIST', playgroundId?: string) => void;
  onExpandChange?: (expanded: boolean) => void; 
  isGameTemplateMode?: boolean; 
  onSaveGameTemplate?: () => void;
  // Route Props
  routes?: GameRoute[];
  onAddRoute?: (route: GameRoute) => void;
  onDeleteRoute?: (id: string) => void;
  onToggleRoute?: (id: string) => void;
  onUpdateRoute?: (id: string, updates: Partial<GameRoute>) => void;
  // Score Props
  showScores?: boolean;
  onToggleScores?: () => void;
  onStartSimulation?: () => void; // New prop
}

const SortablePointItem: React.FC<{
    point: GamePoint,
    index: number,
    isSelected?: boolean,
    isMapHovered?: boolean,
    isDragDisabled?: boolean,
    onEdit: (p: GamePoint) => void,
    onSelect: (p: GamePoint) => void,
    onDelete: (id: string) => void,
    onHover: (p: GamePoint | null) => void,
    taskLists: TaskList[]
}> = ({ point, index, isSelected, isMapHovered, isDragDisabled, onEdit, onSelect, onDelete, onHover, taskLists }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: point.id, disabled: isDragDisabled });
  
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  
  const style = { 
      transform: CSS.Transform.toString(transform), 
      transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)', 
      zIndex: isDragging ? 999 : 'auto', 
      opacity: isDragging ? 0.8 : 1,
      touchAction: 'pan-y'
  };
  
  const Icon = ICON_COMPONENTS[point.iconId];
  const sourceList = taskLists.find(list => list.tasks.some(t => t.title === point.title));
  const listColor = sourceList?.color || 'transparent';
  const displayId = (index + 1).toString().padStart(3, '0');

  useEffect(() => {
      if (isSelected && itemRef.current) {
          itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  }, [isSelected]);

  const handleTouchStart = (e: React.TouchEvent) => {
      if (isDragging) return;
      startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (startX.current === null || isDragging) return;
      const currentX = e.touches[0].clientX;
      const diff = currentX - startX.current;
      // In LEFT drawer mode, dragging RIGHT (positive diff) reveals delete on left
      if (diff > 0) { 
          setDragOffset(Math.min(diff, 150)); 
      }
  };

  const handleTouchEnd = () => {
      if (dragOffset > 80) {
          setDragOffset(500); 
          setTimeout(() => onDelete(point.id), 200);
      } else {
          setDragOffset(0);
      }
      startX.current = null;
  };

  const handleMouseEnter = () => {
    // Immediate hover like DANGER ZONES (no delay)
    onHover(point);
  };

  const handleMouseLeave = () => {
    onHover(null);
  };

  return (
    <div className="relative overflow-hidden my-1 rounded-r-xl touch-pan-y group">
        <div 
            className="absolute inset-y-0 left-0 bg-red-500 flex items-center justify-start pl-4 text-white rounded-r-xl transition-all"
            style={{ 
                width: `${Math.max(0, dragOffset)}px`, 
                opacity: dragOffset > 0 ? 1 : 0,
                zIndex: 0
            }}
        >
            <Trash2 className="w-5 h-5" />
        </div>

        <div 
            ref={(node) => { setNodeRef(node); (itemRef as any).current = node; }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ 
                ...style, 
                borderLeft: `4px solid ${listColor}`,
                transform: transform ? CSS.Transform.toString(transform) : `translateX(${dragOffset}px)`
            }} 
            className={`border-y border-r border-gray-100 dark:border-gray-700 rounded-r-xl p-2 flex items-center gap-2 transition-colors cursor-pointer relative z-10
                ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : isMapHovered ? 'bg-orange-500 ring-2 ring-orange-600' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'}
            `}
            onClick={() => onSelect(point)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div
                {...(!isDragDisabled ? {...attributes, ...listeners} : {})}
                className={`p-1 touch-none ${isMapHovered ? 'text-white' : 'text-gray-300 dark:text-gray-600'} ${isDragDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
            >
                <GripVertical className="w-4 h-4" />
            </div>
            
            <div className="relative">
                <div className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200' : isMapHovered ? 'bg-white text-orange-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${isSelected ? 'bg-blue-600 text-white' : isMapHovered ? 'bg-white text-orange-600' : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'}`}>{displayId}</span>
                <div className="min-w-0">
                    <p className={`font-bold text-xs truncate ${isSelected ? 'text-blue-900 dark:text-blue-100' : isMapHovered ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{point.title}</p>
                    {sourceList && (
                        <p className={`text-[8px] uppercase tracking-wide truncate ${isMapHovered ? 'text-orange-100' : 'text-gray-400'}`} style={isMapHovered ? undefined : { color: sourceList.color }}>
                            {sourceList.name}
                        </p>
                    )}
                </div>
            </div>
            
            <div className={`flex gap-1 pl-2 transition-opacity ${isMapHovered ? 'border-l border-orange-700' : 'border-l border-gray-100 dark:border-gray-700'} ${dragOffset > 0 ? 'opacity-0' : 'opacity-100'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(point); }}
                    className={`p-2 rounded-lg transition-colors ${isMapHovered ? 'text-white hover:text-orange-100 hover:bg-orange-600' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                    title="Edit Task"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
  );
};

const ZoneSection = ({ 
    id,
    title, 
    icon: Icon, 
    count, 
    isCollapsed, 
    onToggle, 
    children, 
    onAdd,
    activeMenu,
    onSetActiveMenu
}: { 
    id: string,
    title: string, 
    icon: any, 
    count: number, 
    isCollapsed: boolean, 
    onToggle: () => void, 
    children?: React.ReactNode, 
    onAdd: (type: 'MANUAL' | 'AI' | 'LIBRARY') => void,
    activeMenu: boolean,
    onSetActiveMenu: (open: boolean) => void
}) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div ref={setNodeRef} className={`mb-2 rounded-xl transition-colors ${isOver ? 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-500' : ''}`}>
            <div 
                onClick={onToggle}
                className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
            >
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-200 tracking-wide">{title}</span>
                    <span className="text-[10px] font-bold bg-white dark:bg-gray-900 px-2 py-0.5 rounded text-gray-500">{count}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </div>
            
            {!isCollapsed && (
                <div className="mt-2 pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-3">
                    {children}
                </div>
            )}
        </div>
    );
};

const EditorDrawer: React.FC<EditorDrawerProps> = ({
  onClose,
  activeGame,
  activeGameName,
  points,
  allPoints = [], 
  games,
  onSelectGame,
  onOpenGameChooser,
  filterState = { mode: 'ALL', value: '' },
  onSetFilter,
  taskLists,
  sourceListId,
  selectedPointId,
  onSetSourceListId,
  onEditPoint,
  onSelectPoint,
  onDeletePoint,
  onReorderPoints,
  onClearMap,
  onSaveGame,
  onOpenTaskMaster,
  onFitBounds,
  onSearchLocation,
  onHoverPoint,
  onHoverDangerZone,
  mapHoveredPointId,
  onOpenPlaygroundEditor,
  initialExpanded = false,
  onAddTask,
  userLocation,
  onExpandChange,
  isGameTemplateMode = false,
  onSaveGameTemplate,
  routes = [],
  onAddRoute,
  onDeleteRoute,
  onToggleRoute,
  onUpdateRoute,
  showScores,
  onToggleScores,
  onStartSimulation
}) => {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialExpanded); 
  const [isSaved, setIsSaved] = useState(false);
  const [isRoutesCollapsed, setIsRoutesCollapsed] = useState(true);
  const [isDangerZonesCollapsed, setIsDangerZonesCollapsed] = useState(true);

  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({ 'map': false });
  const [activeAddMenu, setActiveAddMenu] = useState<string | null>(null);
  
  const gpxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialExpanded) setIsExpanded(true);
  }, [initialExpanded]);

  useEffect(() => {
      if (onExpandChange) onExpandChange(isExpanded);
  }, [isExpanded, onExpandChange]);

  useEffect(() => {
      if (activeGame?.playgrounds) {
          setCollapsedZones(prev => {
              const next = { ...prev };
              activeGame.playgrounds?.forEach(pg => {
                  if (next[pg.id] === undefined) next[pg.id] = false; // Default expanded now
              });
              return next;
          });
      }
  }, [activeGame]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activePoint = allPoints.find(p => p.id === activeId);
    if (!activePoint) return;

    let targetPlaygroundId: string | undefined = undefined;
    let isReorder = false;

    if (overId === 'zone-map') {
        targetPlaygroundId = undefined;
    } else if (overId.startsWith('zone-pg-')) {
        targetPlaygroundId = overId.replace('zone-pg-', '');
    } else {
        const overPoint = allPoints.find(p => p.id === overId);
        if (overPoint) {
            targetPlaygroundId = overPoint.playgroundId;
            isReorder = true;
        } else {
            return; 
        }
    }

    if (activePoint.playgroundId !== targetPlaygroundId) {
        const updatedPoints = allPoints.map(p => {
            if (p.id === activeId) {
                return {
                    ...p,
                    playgroundId: targetPlaygroundId,
                    location: targetPlaygroundId ? { lat: 0, lng: 0 } : (userLocation || { lat: 0, lng: 0 }),
                    playgroundPosition: targetPlaygroundId ? { x: 50, y: 50 } : undefined,
                    playgroundScale: targetPlaygroundId ? 1 : undefined
                };
            }
            return p;
        });

        if (isReorder) {
             const oldIndex = updatedPoints.findIndex(p => p.id === activeId);
             const overIndex = updatedPoints.findIndex(p => p.id === overId);
             onReorderPoints(arrayMove(updatedPoints, oldIndex, overIndex));
        } else {
             onReorderPoints(updatedPoints);
        }
    } else {
        if (isReorder && activeId !== overId) {
            const oldIndex = allPoints.findIndex(p => p.id === activeId);
            const newIndex = allPoints.findIndex(p => p.id === overId);
            onReorderPoints(arrayMove(allPoints, oldIndex, newIndex));
        }
    }
  };

  const handleSaveClick = () => {
    if(!activeGame) return;
    
    if (isGameTemplateMode && onSaveGameTemplate) {
        onSaveGameTemplate();
    } else {
        onSaveGame();
    }
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const toggleZone = (id: string) => {
      setCollapsedZones(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGPXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onAddRoute) return;

      try {
          const coords = await parseGPX(file);
          const newRoute: GameRoute = {
              id: `rt-${Date.now()}`,
              name: file.name.replace('.gpx', ''),
              color: '#ef4444', // Default Red for Ski Map visibility
              points: coords,
              isVisible: true
          };
          onAddRoute(newRoute);
          onFitBounds(coords); // Fit map to new route
      } catch (err) {
          alert('Failed to load GPX: ' + err);
      }
      
      // Reset input
      if (gpxInputRef.current) gpxInputRef.current.value = '';
  };

  const mapPoints = allPoints.filter(p => !p.playgroundId);
  const playgroundGroups = activeGame?.playgrounds?.map(pg => ({
      ...pg,
      points: allPoints.filter(p => p.playgroundId === pg.id)
  })) || [];

  const isFiltered = filterState.mode !== 'ALL';

  return (
    <div 
        className={`fixed top-0 left-0 bottom-0 z-[2100] w-full sm:w-[320px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-r border-gray-200 dark:border-gray-800 pointer-events-auto transition-transform duration-300 ease-in-out ${isExpanded ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Toggle Button moved to the Right of the Left Drawer */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-full top-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 w-8 h-24 rounded-r-xl shadow-lg border-y border-r border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-orange-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center pointer-events-auto"
        title={isExpanded ? "Collapse List" : "Expand List"}
      >
        {isExpanded ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
      </button>

      <button 
          onClick={onOpenGameChooser}
          disabled={isGameTemplateMode} 
          className={`p-4 text-white text-left flex-shrink-0 relative z-[100] transition-all active:scale-[0.98] ${isGameTemplateMode ? 'bg-purple-600 cursor-default' : (activeGame ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-700 hover:bg-slate-800')}`}
      >
          <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                  {isGameTemplateMode ? 'EDITING TEMPLATE' : (activeGame ? 'Active Game' : 'No game active')}
              </span>
              {!isGameTemplateMode && <ChevronDown className="w-4 h-4 opacity-50" />}
          </div>
          <h2 className="font-black text-sm uppercase truncate pr-6">{activeGame ? activeGameName : 'SELECT A GAME'}</h2>
      </button>

      {!activeGame ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black uppercase text-gray-800 dark:text-white mb-2 tracking-widest">No Game Active</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-relaxed">
                  Select a game from the chooser above to start adding or editing map points.
              </p>
          </div>
      ) : (
          <>
            {/* PLAYGROUND SELECTION TILES */}
            {activeGame?.playgrounds && activeGame.playgrounds.length > 0 && onOpenPlaygroundEditor && (
                <div className="px-4 py-3 bg-white dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800">
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">PLAYZONES</div>
                    <div className="grid grid-cols-2 gap-2">
                        {activeGame.playgrounds.map((playground) => {
                            const Icon = ICON_COMPONENTS[playground.iconId];
                            const playgroundPoints = allPoints.filter(p => p.playgroundId === playground.id);
                            return (
                                <button
                                    key={playground.id}
                                    onClick={() => onOpenPlaygroundEditor && onOpenPlaygroundEditor(playground.id)}
                                    className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-md transition-all active:scale-[0.98] text-left group"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform flex-shrink-0">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <h3 className="text-xs font-bold text-gray-800 dark:text-gray-100 mb-1 truncate">{playground.title}</h3>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{playgroundPoints.length} task{playgroundPoints.length !== 1 ? 's' : ''}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex gap-2">
                {onOpenPlaygroundEditor && (
                    <button onClick={() => onOpenPlaygroundEditor && onOpenPlaygroundEditor()} className="flex-1 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors flex items-center justify-center gap-2 text-[10px] uppercase tracking-wide border border-orange-200 dark:border-orange-800">
                        <LayoutGrid className="w-3 h-3" /> ALL ZONES
                    </button>
                )}
                {onStartSimulation && !isGameTemplateMode && (
                    <button onClick={onStartSimulation} className="flex-1 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-2 text-[10px] uppercase tracking-wide border border-purple-200 dark:border-purple-800">
                        <PlayCircle className="w-3 h-3" /> SIMULATE
                    </button>
                )}
            </div>

            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900 flex-shrink-0 z-[60]">
                <div>
                    <h2 className="font-bold text-xs text-gray-400 uppercase tracking-wide">Tasks List</h2>
                    <p className="text-[10px] text-gray-500 uppercase">{allPoints.length} points defined</p>
                </div>
                {onOpenPlaygroundEditor && (
                    <button
                        onClick={() => onOpenPlaygroundEditor()}
                        className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
                        title="Open Playzone Editor"
                    >
                        <LayoutGrid className="w-4 h-4" />
                        ADD PLAYZONE
                    </button>
                )}
            </div>

            <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 relative z-[50]">
                <button 
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className={`w-full p-3 flex items-center justify-between transition-colors ${isFiltered ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500'}`}
                >
                    <div className="flex items-center gap-2">
                        {isFiltered ? <Eye className="w-4 h-4" /> : <Filter className="w-4 h-4 opacity-70" />}
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {isFiltered ? 
                                (filterState.mode === 'TAG' ? `TAG: ${filterState.value}` : `FILTER ACTIVE`) 
                                : "FILTER MAP POINTS"}
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
                </button>

                {showFilterMenu && onSetFilter && (
                    <div className="absolute top-full left-0 right-0 z-[6000] p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-2xl animate-in slide-in-from-top-2 max-h-80 overflow-y-auto">
                        <button 
                            onClick={() => { onSetFilter({ mode: 'ALL', value: '' }); setShowFilterMenu(false); }}
                            className="w-full mb-2 py-2 text-xs font-bold uppercase text-red-500 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            Reset Filter (Show All)
                        </button>
                        <div className="text-center text-[10px] text-gray-400 p-2">Use map filter bar for advanced options.</div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50 z-0">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    {/* --- MAP TASKS --- */}
                    <SortableContext items={mapPoints.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        <ZoneSection 
                            id="zone-map"
                            title="ON MAP" 
                            icon={Map} 
                            count={mapPoints.length} 
                            isCollapsed={!!collapsedZones['map']} 
                            onToggle={() => toggleZone('map')}
                            activeMenu={activeAddMenu === 'map'}
                            onSetActiveMenu={(open) => setActiveAddMenu(open ? 'map' : null)}
                            onAdd={(type) => onAddTask && onAddTask(type)}
                        >
                            <div className="space-y-1">
                                {mapPoints.length === 0 && <div className="text-[10px] text-gray-400 italic p-2">No tasks on map yet. Drop items here or Add New.</div>}
                                {mapPoints.map((point, index) => (
                                    <SortablePointItem
                                        key={point.id}
                                        point={point}
                                        index={index}
                                        isSelected={point.id === selectedPointId}
                                        isMapHovered={point.id === mapHoveredPointId}
                                        isDragDisabled={isFiltered}
                                        onEdit={onEditPoint}
                                        onSelect={onSelectPoint}
                                        onDelete={onDeletePoint}
                                        onHover={(p) => onHoverPoint && onHoverPoint(p)}
                                        taskLists={taskLists}
                                    />
                                ))}
                            </div>
                        </ZoneSection>
                    </SortableContext>

                    {/* --- GPX ROUTES & OVERLAYS --- */}
                    <div className="mb-2 rounded-xl">
                        <div 
                            onClick={() => setIsRoutesCollapsed(!isRoutesCollapsed)}
                            className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-2">
                                <Route className="w-4 h-4 text-orange-500" />
                                <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-200 tracking-wide">ROUTES & TRAILS</span>
                                <span className="text-[10px] font-bold bg-white dark:bg-gray-900 px-2 py-0.5 rounded text-gray-500">{routes.length}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isRoutesCollapsed ? '-rotate-90' : ''}`} />
                        </div>
                        
                        {!isRoutesCollapsed && (
                            <div className="mt-2 pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-3 space-y-2">
                                <button 
                                    onClick={() => gpxInputRef.current?.click()}
                                    className="w-full py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                    <Upload className="w-3 h-3" /> UPLOAD GPX
                                </button>
                                <input ref={gpxInputRef} type="file" accept=".gpx" className="hidden" onChange={handleGPXUpload} />

                                {routes.map(route => (
                                    <div key={route.id} className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center justify-between group">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <input 
                                                type="color" 
                                                value={route.color}
                                                onChange={(e) => onUpdateRoute && onUpdateRoute(route.id, { color: e.target.value })}
                                                className="w-4 h-4 rounded-full border-none p-0 bg-transparent cursor-pointer overflow-hidden flex-shrink-0"
                                                title="Change Route Color"
                                            />
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate cursor-default" title={route.name}>{route.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => onToggleRoute && onToggleRoute(route.id)}
                                                className={`p-1.5 rounded-lg ${route.isVisible ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                {route.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                            </button>
                                            <button 
                                                onClick={() => onDeleteRoute && onDeleteRoute(route.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* --- DANGER ZONES --- */}
                    <div className="mb-2 rounded-xl">
                        <div
                            onClick={() => setIsDangerZonesCollapsed(!isDangerZonesCollapsed)}
                            className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-200 tracking-wide">DANGER ZONES</span>
                                <span className="text-[10px] font-bold bg-white dark:bg-gray-900 px-2 py-0.5 rounded text-gray-500">{activeGame?.dangerZones?.length || 0}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDangerZonesCollapsed ? '-rotate-90' : ''}`} />
                        </div>

                        {!isDangerZonesCollapsed && (
                            <div className="mt-2 pl-2 border-l-2 border-gray-200 dark:border-gray-800 ml-3 space-y-2">
                                {(activeGame?.dangerZones || []).length === 0 && (
                                    <div className="text-[10px] text-gray-400 italic p-2">
                                        No danger zones. Click a zone on the map to edit it.
                                    </div>
                                )}

                                {(activeGame?.dangerZones || []).map(zone => (
                                    <div
                                        key={zone.id}
                                        className="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors cursor-pointer"
                                        onMouseEnter={() => onHoverDangerZone && onHoverDangerZone(zone.id)}
                                        onMouseLeave={() => onHoverDangerZone && onHoverDangerZone(null)}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0">⚠</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{zone.title || 'Danger Zone'}</div>
                                                <div className="text-[10px] text-gray-500">
                                                    Radius: {zone.radius}m • Penalty: {zone.penalty}pts
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => onDeletePoint && onDeletePoint(zone.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete danger zone"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* --- PLAYGROUNDS --- */}
                    {playgroundGroups.map(pg => (
                        <SortableContext key={pg.id} items={pg.points.map(p => p.id)} strategy={verticalListSortingStrategy}>
                            <ZoneSection 
                                id={`zone-pg-${pg.id}`}
                                title={pg.title} 
                                icon={Gamepad2} 
                                count={pg.points.length} 
                                isCollapsed={!!collapsedZones[pg.id]} 
                                onToggle={() => toggleZone(pg.id)}
                                activeMenu={activeAddMenu === pg.id}
                                onSetActiveMenu={(open) => setActiveAddMenu(open ? pg.id : null)}
                                onAdd={(type) => onAddTask && onAddTask(type, pg.id)}
                            >
                                <div className="space-y-1">
                                    {pg.points.length === 0 && <div className="text-[10px] text-gray-400 italic p-2">No tasks in this playground. Add items here.</div>}
                                    {pg.points.map((point, index) => (
                                        <SortablePointItem
                                            key={point.id}
                                            point={point}
                                            index={index}
                                            isSelected={point.id === selectedPointId}
                                            isMapHovered={point.id === mapHoveredPointId}
                                            isDragDisabled={isFiltered}
                                            onEdit={onEditPoint}
                                            onSelect={onSelectPoint}
                                            onDelete={onDeletePoint}
                                            onHover={(p) => onHoverPoint && onHoverPoint(p)}
                                            taskLists={taskLists}
                                        />
                                    ))}
                                </div>
                            </ZoneSection>
                        </SortableContext>
                    ))}
                </DndContext>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-2 z-[60]">
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => onAddTask && onAddTask('TASKLIST')}
                        className="py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wide border border-blue-200 dark:border-blue-800"
                        title="Add tasks from a saved tasklist to your game"
                    >
                        <LayoutList className="w-4 h-4" /> FROM TASKLIST
                    </button>
                    <button 
                        onClick={() => onAddTask && onAddTask('AI')}
                        className="py-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wide border border-purple-200 dark:border-purple-800"
                    >
                        <Wand2 className="w-4 h-4" /> AI GENERATE
                    </button>
                    <button
                        onClick={() => onAddTask && onAddTask('LIBRARY')}
                        className="py-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wide border border-indigo-200 dark:border-indigo-800"
                        title="Add tasks from the global library"
                    >
                        <Library className="w-4 h-4" /> FROM LIB
                    </button>
                </div>

                {!isGameTemplateMode && onSaveGameTemplate && (
                    <button
                        onClick={() => {
                            if (!activeGame) return;
                            onSaveGameTemplate();
                        }}
                        className="w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg text-sm uppercase tracking-wide bg-purple-600 text-white hover:bg-purple-700"
                    >
                        <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4" /> Save as Game Template
                        </div>
                    </button>
                )}

                <button
                    onClick={handleSaveClick}
                    className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg text-sm uppercase tracking-wide ${isSaved ? 'bg-green-100 text-green-700 border-2 border-green-500' : (isGameTemplateMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20')}`}
                >
                    {isSaved ? <><div className="flex items-center gap-2"><Check className="w-4 h-4" /> {isGameTemplateMode ? 'TEMPLATE UPDATED!' : 'GAME SAVED!'}</div></> : (isGameTemplateMode ? <><div className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Update Template</div></> : <><div className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Game</div></>)}
                </button>
            </div>
          </>
      )}
    </div>
  );
};

export default EditorDrawer;
