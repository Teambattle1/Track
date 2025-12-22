
import React, { useState, useEffect, useRef } from 'react';
import { GamePoint, TaskList, Coordinate, Game } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { X, MousePointerClick, GripVertical, Edit2, Eraser, Save, Check, ChevronDown, Plus, Library, Trash2, Eye, Filter, ChevronRight, ChevronLeft, Maximize, Gamepad2, AlertCircle, LayoutGrid, Map, Wand2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  onFitBounds: () => void;
  onHoverPoint?: (point: GamePoint | null) => void;
  onOpenPlaygroundEditor?: () => void;
  initialExpanded?: boolean;
  onAddTask?: (type: 'MANUAL' | 'AI' | 'LIBRARY', playgroundId?: string) => void;
}

const SortablePointItem: React.FC<{ 
    point: GamePoint, 
    index: number,
    isSelected?: boolean,
    isDragDisabled?: boolean,
    onEdit: (p: GamePoint) => void,
    onSelect: (p: GamePoint) => void,
    onDelete: (id: string) => void,
    onHover: (p: GamePoint | null) => void,
    taskLists: TaskList[] 
}> = ({ point, index, isSelected, isDragDisabled, onEdit, onSelect, onDelete, onHover, taskLists }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: point.id, disabled: isDragDisabled });
  
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  
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
    hoverTimeoutRef.current = window.setTimeout(() => {
      onHover(point);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
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
            className={`bg-white dark:bg-gray-800 border-y border-r border-gray-100 dark:border-gray-700 rounded-r-xl p-2 flex items-center gap-2 transition-colors cursor-pointer relative z-10
                ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-750'}
            `}
            onClick={() => onSelect(point)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div 
                {...(!isDragDisabled ? {...attributes, ...listeners} : {})} 
                className={`text-gray-300 dark:text-gray-600 p-1 touch-none ${isDragDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
            >
                <GripVertical className="w-4 h-4" />
            </div>
            
            <div className="relative">
                <div className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'}`}>{displayId}</span>
                <div className="min-w-0">
                    <p className={`font-bold text-xs truncate ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-800 dark:text-gray-200'}`}>{point.title}</p>
                    {sourceList && (
                        <p className="text-[8px] text-gray-400 uppercase tracking-wide truncate" style={{ color: sourceList.color }}>
                            {sourceList.name}
                        </p>
                    )}
                </div>
            </div>
            
            <div className={`flex gap-1 pl-2 border-l border-gray-100 dark:border-gray-700 transition-opacity ${dragOffset > 0 ? 'opacity-0' : 'opacity-100'}`}>
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(point); }} 
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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
                    
                    {/* Add Task Button for this Zone */}
                    <div className="relative mt-2">
                        <button 
                            onClick={() => onSetActiveMenu(!activeMenu)}
                            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-400 hover:text-orange-500 hover:border-orange-500 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all"
                        >
                            <Plus className="w-3 h-3" /> Add Task Here
                        </button>
                        
                        {activeMenu && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 animate-in slide-in-from-top-1 overflow-hidden">
                                <button onClick={() => { onAdd('MANUAL'); onSetActiveMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3">
                                    <div className="bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-lg"><Plus className="w-4 h-4 text-orange-600" /></div>
                                    <span className="text-xs font-bold uppercase text-gray-800 dark:text-white">New Blank Task</span>
                                </button>
                                <button onClick={() => { onAdd('AI'); onSetActiveMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-t border-gray-100 dark:border-gray-700">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-lg"><Wand2 className="w-4 h-4 text-purple-600" /></div>
                                    <span className="text-xs font-bold uppercase text-gray-800 dark:text-white">AI Generator</span>
                                </button>
                                <button onClick={() => { onAdd('LIBRARY'); onSetActiveMenu(false); }} className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-t border-gray-100 dark:border-gray-700">
                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg"><Library className="w-4 h-4 text-blue-600" /></div>
                                    <span className="text-xs font-bold uppercase text-gray-800 dark:text-white">From Library</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const EditorDrawer: React.FC<EditorDrawerProps> = ({
  onClose,
  activeGame,
  activeGameName,
  points, // This is technically "displayPoints" passed from App
  allPoints = [], // This is the full list from activeGame
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
  onHoverPoint,
  onOpenPlaygroundEditor,
  initialExpanded = false,
  onAddTask,
  userLocation
}) => {
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialExpanded); 
  const [isSaved, setIsSaved] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  
  // Grouping State
  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({ 'map': true }); // Default collapsed
  const [activeAddMenu, setActiveAddMenu] = useState<string | null>(null);

  useEffect(() => {
    if (initialExpanded) setIsExpanded(true);
  }, [initialExpanded]);

  // Initialize collapse state for playgrounds once loaded
  useEffect(() => {
      if (activeGame?.playgrounds) {
          setCollapsedZones(prev => {
              const next = { ...prev };
              activeGame.playgrounds?.forEach(pg => {
                  if (next[pg.id] === undefined) next[pg.id] = true;
              });
              return next;
          });
      }
  }, [activeGame?.playgrounds]);

  const activeSourceList = taskLists.find(l => l.id === sourceListId);
  
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

    // Determine target zone
    if (overId === 'zone-map') {
        targetPlaygroundId = undefined;
    } else if (overId.startsWith('zone-pg-')) {
        targetPlaygroundId = overId.replace('zone-pg-', '');
    } else {
        // Dropped on another Item
        const overPoint = allPoints.find(p => p.id === overId);
        if (overPoint) {
            targetPlaygroundId = overPoint.playgroundId;
            isReorder = true;
        } else {
            return; // Unknown drop target
        }
    }

    if (activePoint.playgroundId !== targetPlaygroundId) {
        // Move to new zone
        const updatedPoints = allPoints.map(p => {
            if (p.id === activeId) {
                return {
                    ...p,
                    playgroundId: targetPlaygroundId,
                    // Reset position if moving to map (use center or user loc), or set default if moving to playground
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
        // Same zone, simple reorder
        if (isReorder && activeId !== overId) {
            const oldIndex = allPoints.findIndex(p => p.id === activeId);
            const newIndex = allPoints.findIndex(p => p.id === overId);
            onReorderPoints(arrayMove(allPoints, oldIndex, newIndex));
        }
    }
  };

  const handleSaveClick = () => {
    if(!activeGame) return;
    onSaveGame();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const toggleZone = (id: string) => {
      setCollapsedZones(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group Points
  const mapPoints = allPoints.filter(p => !p.playgroundId);
  const playgroundGroups = activeGame?.playgrounds?.map(pg => ({
      ...pg,
      points: allPoints.filter(p => p.playgroundId === pg.id)
  })) || [];

  const isFiltered = filterState.mode !== 'ALL';

  return (
    <div 
        className={`absolute top-0 left-0 bottom-0 z-[1100] w-full sm:w-[320px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-r border-gray-200 dark:border-gray-800 pointer-events-auto transition-transform duration-300 ease-in-out ${isExpanded ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-full top-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 w-8 h-24 rounded-r-xl shadow-lg border-y border-r border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-orange-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center pointer-events-auto"
        title={isExpanded ? "Collapse List" : "Expand List"}
      >
        {isExpanded ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
      </button>

      <button 
          onClick={onOpenGameChooser}
          className={`p-4 text-white text-left flex-shrink-0 relative z-[100] transition-all active:scale-[0.98] ${activeGame ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-700 hover:bg-slate-800'}`}
      >
          <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{activeGame ? 'Active Game' : 'No game active'}</span>
              <ChevronDown className="w-4 h-4 opacity-50" />
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
            {onOpenPlaygroundEditor && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                    <button onClick={onOpenPlaygroundEditor} className="w-full py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wide border border-orange-200 dark:border-orange-800">
                        <LayoutGrid className="w-4 h-4" /> PLAYGROUNDS
                    </button>
                </div>
            )}

            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900 flex-shrink-0 z-[60]">
                <div>
                    <h2 className="font-bold text-xs text-gray-400 uppercase tracking-wide">Tasks List</h2>
                    <p className="text-[10px] text-gray-500 uppercase">{allPoints.length} points defined</p>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={onFitBounds} 
                        className="p-2 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400 transition-colors"
                        title="Fit Map to All Tasks"
                    >
                        <Maximize className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
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
                        {/* Simplified filter menu for now */}
                        <div className="text-center text-[10px] text-gray-400 p-2">Use map filter bar for advanced options.</div>
                    </div>
                )}
            </div>

            {/* Main Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50 z-0">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    
                    {/* MAP ZONE */}
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
                                {mapPoints.length === 0 && <div className="text-[10px] text-gray-400 italic p-2">No tasks on map yet. Drop items here.</div>}
                                {mapPoints.map((point, index) => (
                                    <SortablePointItem 
                                        key={point.id} 
                                        point={point} 
                                        index={index}
                                        isSelected={point.id === selectedPointId}
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

                    {/* PLAYGROUND ZONES */}
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
                                    {pg.points.length === 0 && <div className="text-[10px] text-gray-400 italic p-2">No tasks in this playground. Drop items here.</div>}
                                    {pg.points.map((point, index) => (
                                        <SortablePointItem 
                                            key={point.id} 
                                            point={point} 
                                            index={index}
                                            isSelected={point.id === selectedPointId}
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
                <button onClick={onOpenTaskMaster} className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wide">
                    <Library className="w-4 h-4" /> Manage Task Library
                </button>
                <button 
                    onClick={handleSaveClick} 
                    className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg text-sm uppercase tracking-wide ${isSaved ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'}`}
                >
                    {isSaved ? <><div className="flex items-center gap-2"><Check className="w-4 h-4" /> GAME SAVED!</div></> : <><div className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Game</div></>}
                </button>
            </div>
          </>
      )}
    </div>
  );
};

export default EditorDrawer;
