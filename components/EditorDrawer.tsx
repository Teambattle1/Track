
import React, { useState, useEffect, useRef } from 'react';
import { GamePoint, TaskList, Coordinate, Game } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { X, MousePointerClick, GripVertical, Edit2, Eraser, Save, Check, ChevronDown, Plus, Library, Trash2, Eye, Filter, ChevronRight, ChevronLeft, Maximize, Gamepad2, AlertCircle, LayoutGrid } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
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
  onOpenPlaygroundEditor?: () => void; // New prop
  initialExpanded?: boolean;
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
  onHoverPoint,
  onOpenPlaygroundEditor,
  initialExpanded = false
}) => {
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialExpanded); 
  const [isSaved, setIsSaved] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    if (initialExpanded) setIsExpanded(true);
  }, [initialExpanded]);

  const activeSourceList = taskLists.find(l => l.id === sourceListId);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = points.findIndex((p) => p.id === active.id);
      const newIndex = points.findIndex((p) => p.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderPoints(arrayMove(points, oldIndex, newIndex));
      }
    }
  };

  const handleSaveClick = () => {
    if(!activeGame) return;
    onSaveGame();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const placedCount = activeSourceList ? (allPoints || points).filter(p => activeSourceList.tasks.some(t => t.title === p.title)).length : 0;
  const totalCount = activeSourceList ? activeSourceList.tasks.length : 0;
  const remaining = totalCount - placedCount;
  const isExhausted = activeSourceList && remaining <= 0;

  const availableTags = Array.from(new Set(allPoints.flatMap(p => p.tags || []))).sort();
  const availableLists = taskLists.filter(list => allPoints.some(p => list.tasks.some(t => t.title === p.title)));
  const orphanPoints = allPoints.filter(p => !taskLists.some(list => list.tasks.some(t => t.title === p.title)));

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
                                (filterState.mode === 'TAG' ? `TAG: ${filterState.value}` : `LIST: ${taskLists.find(l => l.id === filterState.value)?.name || (filterState.value === 'orphan' ? 'Unlisted' : 'Unknown')}`) 
                                : "FILTER MAP POINTS"}
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
                </button>

                {showFilterMenu && (
                    <div className="absolute top-full left-0 right-0 z-[6000] p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-2xl animate-in slide-in-from-top-2 max-h-80 overflow-y-auto">
                        {isFiltered && onSetFilter && (
                            <button 
                                onClick={() => { onSetFilter({ mode: 'ALL', value: '' }); setShowFilterMenu(false); }}
                                className="w-full mb-3 py-1.5 text-xs font-bold uppercase text-red-500 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                Reset Filter (Show All)
                            </button>
                        )}

                        {availableTags.length > 0 && onSetFilter && (
                            <div className="mb-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">BY TAG</p>
                                <div className="flex flex-wrap gap-1">
                                    {availableTags.map(tag => (
                                        <button 
                                            key={tag}
                                            onClick={() => { onSetFilter({ mode: 'TAG', value: tag }); setShowFilterMenu(false); }}
                                            className={`px-2 py-1 rounded text-[10px] uppercase font-bold border transition-colors ${filterState.mode === 'TAG' && filterState.value === tag ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-indigo-400'}`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {onSetFilter && (availableLists.length > 0 || orphanPoints.length > 0) && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">BY SOURCE LIST</p>
                                <div className="flex flex-col gap-1">
                                    {availableLists.map(list => (
                                        <button 
                                            key={list.id}
                                            onClick={() => { onSetFilter({ mode: 'LIST', value: list.id }); setShowFilterMenu(false); }}
                                            className={`px-2 py-1.5 rounded text-[10px] uppercase font-bold text-left border flex items-center gap-2 transition-colors ${filterState.mode === 'LIST' && filterState.value === list.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-indigo-400'}`}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: list.color }}></div>
                                            {list.name}
                                        </button>
                                    ))}
                                    {orphanPoints.length > 0 && (
                                        <button 
                                            onClick={() => { onSetFilter({ mode: 'LIST', value: 'orphan' }); setShowFilterMenu(false); }}
                                            className={`px-2 py-1.5 rounded text-[10px] uppercase font-bold text-left border flex items-center gap-2 transition-colors ${filterState.mode === 'LIST' && filterState.value === 'orphan' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-indigo-400'}`}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                            Custom / Unlisted
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {!availableTags.length && !availableLists.length && !orphanPoints.length && (
                            <div className="text-center py-4 text-gray-400">
                                <p className="text-[10px] uppercase font-bold">No filters available</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 relative z-[40]">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Map Click Behavior</label>
                <button 
                    onClick={() => setShowSourceMenu(!showSourceMenu)}
                    className={`w-full p-2 rounded-xl border flex items-center gap-2 text-left transition-all ${isExhausted ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400'}`}
                >
                    <div className={`p-1.5 rounded-lg ${activeSourceList ? 'text-white' : 'bg-gray-100 text-gray-500'}`} style={{ backgroundColor: activeSourceList?.color }}>
                        <MousePointerClick className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-gray-800 dark:text-gray-200 truncate uppercase">
                            {activeSourceList ? activeSourceList.name : 'Place New (Empty)'}
                        </p>
                        {activeSourceList && (
                            <p className={`text-[10px] font-bold uppercase ${isExhausted ? 'text-red-500' : 'text-green-500'}`}>
                                {isExhausted ? 'All placed!' : `${remaining} remaining`}
                            </p>
                        )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showSourceMenu && (
                    <div className="absolute top-full left-4 right-4 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-[5000]">
                        <button onClick={() => { onSetSourceListId(''); setShowSourceMenu(false); }} className="w-full p-2 text-left text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 uppercase">
                            <div className="p-1 rounded bg-gray-200 dark:bg-gray-700"><Plus className="w-3 h-3" /></div>
                            Place New (Empty Task)
                            {!sourceListId && <Check className="w-3 h-3 ml-auto text-blue-500" />}
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                        {taskLists.map(list => {
                                const lPlaced = (allPoints || points).filter(p => list.tasks.some(t => t.title === p.title)).length;
                                const lTotal = list.tasks.length;
                                const ListIcon = list.iconId ? ICON_COMPONENTS[list.iconId] : Plus; 
                                
                                return (
                                    <button key={list.id} onClick={() => { onSetSourceListId(list.id); setShowSourceMenu(false); }} className="w-full p-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 uppercase">
                                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: list.color }}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                {list.iconId && <ListIcon className="w-3 h-3 text-gray-500" />}
                                                <p className="font-bold text-xs text-gray-800 dark:text-gray-200 truncate">{list.name}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-500">{lTotal - lPlaced} left</p>
                                        </div>
                                        {sourceListId === list.id && <Check className="w-3 h-3 text-blue-500" />}
                                    </button>
                                );
                        })}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50 z-0">
                <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {isFiltered ? `Found ${points.length} of ${allPoints.length}` : `Map Points (${points.length})`}
                    </label>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (clearConfirm) {
                                if (isFiltered) onClearMap(points.map(p => p.id));
                                else onClearMap();
                                setClearConfirm(false);
                            } else {
                                setClearConfirm(true);
                                setTimeout(() => setClearConfirm(false), 3000);
                            }
                        }}
                        className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider transition-all ${
                            clearConfirm 
                                ? 'bg-red-600 text-white px-3 py-1 rounded animate-pulse shadow-md' 
                                : (isFiltered ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded' : 'text-red-500 hover:text-red-600')
                        }`}
                    >
                        {clearConfirm ? (
                            "CONFIRM DELETE?"
                        ) : (
                            <>
                                <Eraser className="w-3 h-3" /> {isFiltered ? `Delete ${points.length} Visible` : 'Clear All'}
                            </>
                        )}
                    </button>
                </div>

                {isFiltered && (
                    <div className="mb-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-[10px] text-indigo-600 dark:text-indigo-400 text-center font-bold uppercase">
                        Filter active • Sorting disabled
                    </div>
                )}

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={points.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1">
                            {points.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    <p className="text-xs uppercase tracking-wide">
                                        {isFiltered ? "No points match filter." : "Tap map to place tasks."}
                                    </p>
                                </div>
                            )}
                            {points.map((point, index) => (
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
                    </SortableContext>
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
