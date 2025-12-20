
import React, { useState, useEffect, useRef } from 'react';
import { GamePoint, TaskList } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { X, MousePointerClick, GripVertical, Edit2, Eraser, Save, Check, ChevronDown, Plus, Library, Trash2, ArrowRight } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface EditorDrawerProps {
  onClose: () => void;
  activeGameName: string;
  points: GamePoint[];
  taskLists: TaskList[];
  sourceListId: string;
  selectedPointId?: string;
  onSetSourceListId: (id: string) => void;
  onEditPoint: (point: GamePoint) => void;
  onSelectPoint: (point: GamePoint) => void;
  onDeletePoint: (pointId: string) => void; 
  onReorderPoints: (points: GamePoint[]) => void;
  onClearMap: () => void;
  onSaveGame: () => void;
  onOpenTaskMaster: () => void;
}

const SortablePointItem: React.FC<{ 
    point: GamePoint, 
    index: number,
    isSelected?: boolean,
    onEdit: (p: GamePoint) => void,
    onSelect: (p: GamePoint) => void,
    onDelete: (id: string) => void,
    taskLists: TaskList[] 
}> = ({ point, index, isSelected, onEdit, onSelect, onDelete, taskLists }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: point.id });
  
  // Swipe State
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const isSwiping = useRef(false);
  
  // DND Kit Transform takes precedence during sorting
  const style = { 
      transform: CSS.Transform.toString(transform), 
      transition: isDragging || isSwiping.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)', 
      zIndex: isDragging ? 999 : 'auto', 
      opacity: isDragging ? 0.8 : 1,
      touchAction: 'pan-y' // Allow vertical scroll, handle horizontal manually
  };
  
  const Icon = ICON_COMPONENTS[point.iconId];
  const sourceList = taskLists.find(list => list.tasks.some(t => t.title === point.title));
  const listColor = sourceList?.color || 'transparent';
  const displayId = (index + 1).toString().padStart(3, '0');

  // Auto-scroll
  useEffect(() => {
      if (isSelected && itemRef.current) {
          itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  }, [isSelected]);

  // Touch Handlers for Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
      if (isDragging) return;
      startX.current = e.touches[0].clientX;
      isSwiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (startX.current === null || isDragging) return;
      const currentX = e.touches[0].clientX;
      const diff = currentX - startX.current;
      
      // Only allow swipe right (positive diff)
      if (diff > 0) {
          setDragOffset(Math.min(diff, 150)); // Cap visual drag
      }
  };

  const handleTouchEnd = () => {
      isSwiping.current = false;
      if (dragOffset > 80) {
          // Threshold met - trigger delete
          // Visual feedback before deletion
          setDragOffset(500); // Fly off screen
          setTimeout(() => onDelete(point.id), 200);
      } else {
          // Snap back
          setDragOffset(0);
      }
      startX.current = null;
  };

  return (
    <div className="relative overflow-hidden my-1 rounded-r-xl touch-pan-y group">
        {/* Swipe Background Action (Delete) - Visible when swiping right */}
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

        {/* The Item Content */}
        <div 
            ref={(node) => { setNodeRef(node); (itemRef as any).current = node; }}
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
            {/* Drag Handle */}
            <div {...attributes} {...listeners} className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing p-1 touch-none">
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
            
            {/* Action Buttons (Visible on desktop / hidden on swipe) */}
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
  activeGameName,
  points,
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
  onOpenTaskMaster
}) => {
  const [showSourceMenu, setShowSourceMenu] = useState(false);
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

  // Calculate remaining in list
  const placedCount = activeSourceList ? points.filter(p => activeSourceList.tasks.some(t => t.title === p.title)).length : 0;
  const totalCount = activeSourceList ? activeSourceList.tasks.length : 0;
  const remaining = totalCount - placedCount;
  const isExhausted = activeSourceList && remaining <= 0;

  return (
    <div className="absolute top-0 left-0 bottom-0 z-[1100] w-full sm:w-[320px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 border-r border-gray-200 dark:border-gray-800 pointer-events-auto">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
        <div>
            <h2 className="font-bold text-gray-900 dark:text-white truncate max-w-[200px] uppercase tracking-wide">{activeGameName}</h2>
            <p className="text-xs text-gray-500 uppercase">{points.length} points defined</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-500">
            <X className="w-5 h-5" />
        </button>
      </div>

      {/* Source Selector */}
      <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 relative z-20">
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

          {/* Dropdown Menu */}
          {showSourceMenu && (
              <div className="absolute top-full left-4 right-4 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto z-50">
                   <button onClick={() => { onSetSourceListId(''); setShowSourceMenu(false); }} className="w-full p-2 text-left text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 uppercase">
                       <div className="p-1 rounded bg-gray-200 dark:bg-gray-700"><Plus className="w-3 h-3" /></div>
                       Place New (Empty Task)
                       {!sourceListId && <Check className="w-3 h-3 ml-auto text-blue-500" />}
                   </button>
                   <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                   {taskLists.map(list => {
                        const lPlaced = points.filter(p => list.tasks.some(t => t.title === p.title)).length;
                        const lTotal = list.tasks.length;
                        const ListIcon = list.iconId ? ICON_COMPONENTS[list.iconId] : Plus; // Fallback
                        
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

      {/* Points List */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50">
         <div className="flex justify-between items-center mb-3">
             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Map Points ({points.length})</label>
             <button 
                onClick={(e) => { e.stopPropagation(); onClearMap(); }}
                className="text-[10px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1 uppercase tracking-wider"
             >
                 <Eraser className="w-3 h-3" /> Clear All
             </button>
         </div>

         <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
             <SortableContext items={points.map(p => p.id)} strategy={verticalListSortingStrategy}>
                 <div className="space-y-1">
                     {points.length === 0 && (
                         <div className="text-center py-8 text-gray-400">
                             <p className="text-xs uppercase tracking-wide">Tap map to place tasks.</p>
                         </div>
                     )}
                     {points.map((point, index) => (
                         <SortablePointItem 
                            key={point.id} 
                            point={point} 
                            index={index}
                            isSelected={point.id === selectedPointId}
                            onEdit={onEditPoint}
                            onSelect={onSelectPoint}
                            onDelete={onDeletePoint}
                            taskLists={taskLists}
                         />
                     ))}
                 </div>
             </SortableContext>
         </DndContext>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-2">
          <button onClick={onOpenTaskMaster} className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wide">
              <Library className="w-4 h-4" /> Manage Task Library
          </button>
          <button onClick={onSaveGame} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 text-sm uppercase tracking-wide">
              <Save className="w-4 h-4" /> Save Game
          </button>
      </div>
    </div>
  );
};

export default EditorDrawer;
