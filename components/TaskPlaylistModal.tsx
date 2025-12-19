import React, { useState } from 'react';
import { GamePoint } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { 
    DndContext, 
    closestCenter, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors, 
    DragEndEvent 
} from '@dnd-kit/core';
import { 
    arrayMove, 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy, 
    useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Wand2, Edit2, Trash2, X, Move, Split, Layers, Type } from 'lucide-react';

interface TaskPlaylistModalProps {
    points: GamePoint[];
    onReorder: (points: GamePoint[]) => void;
    onClose: () => void;
    onEditTask: (point: GamePoint) => void;
    onDeleteTask: (id: string) => void;
    onInsertTask: (index: number) => void; // Trigger generic insert (opens library/AI)
    onAddDivider: (index: number) => void;
}

const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

interface SortableItemProps {
    point: GamePoint;
    index: number;
    onEdit: (p: GamePoint) => void;
    onDelete: (id: string) => void;
    onInsertTask: (idx: number) => void;
    onAddDivider: (idx: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ 
    point, 
    index, 
    onEdit, 
    onDelete, 
    onInsertTask, 
    onAddDivider 
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: point.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 999 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    const Icon = ICON_COMPONENTS[point.iconId];
    const displayId = (index + 1).toString().padStart(3, '0');
    
    // Hover state for insertion line
    const [showInsert, setShowInsert] = useState(false);

    return (
        <div ref={setNodeRef} style={style} className="relative group/item">
            {/* Insertion Trigger (Top) */}
            <div 
                className="h-2 -mt-1 w-full flex items-center justify-center opacity-0 hover:opacity-100 z-10 cursor-pointer absolute top-0"
                onClick={(e) => { e.stopPropagation(); }} // Prevent drag start
            >
                <div className="w-full h-0.5 bg-indigo-500 relative flex items-center justify-center">
                    <div className="bg-indigo-600 text-white rounded-full p-1 flex gap-2 shadow-sm transform scale-75 hover:scale-100 transition-transform">
                        <button onClick={() => onInsertTask(index)} className="hover:bg-indigo-700 p-1 rounded" title="Insert Task"><Plus className="w-4 h-4" /></button>
                        <button onClick={() => onAddDivider(index)} className="hover:bg-indigo-700 p-1 rounded" title="Insert Divider"><Split className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            <div className={`
                flex items-center gap-3 p-3 mb-2 rounded-xl border transition-all
                ${point.isSectionHeader 
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 mt-4' 
                    : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:shadow-md'
                }
                ${isDragging ? 'shadow-2xl ring-2 ring-indigo-500 rotate-1' : ''}
            `}>
                <div {...attributes} {...listeners} className="text-gray-400 cursor-grab active:cursor-grabbing p-1">
                    <GripVertical className="w-5 h-5" />
                </div>

                {point.isSectionHeader ? (
                    <div className="flex-1 flex items-center gap-2">
                         <div className="bg-gray-200 dark:bg-gray-700 p-1.5 rounded-lg">
                             <Layers className="w-4 h-4 text-gray-500" />
                         </div>
                         <div className="flex-1 font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs">
                             {point.title}
                         </div>
                    </div>
                ) : (
                    <>
                        <div className="font-mono text-xs font-bold text-indigo-500 w-8">
                            {displayId}
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 dark:text-white truncate text-sm">{point.title}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stripHtml(point.task.question)}</p>
                        </div>
                    </>
                )}

                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button 
                        onClick={() => onEdit(point)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => onDelete(point.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Insertion Trigger (Bottom - only for last item) */}
        </div>
    );
};

const TaskPlaylistModal: React.FC<TaskPlaylistModalProps> = ({ 
    points, 
    onReorder, 
    onClose, 
    onEditTask, 
    onDeleteTask,
    onInsertTask,
    onAddDivider
}) => {
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
                onReorder(arrayMove(points, oldIndex, newIndex));
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-gray-50 dark:bg-gray-950 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-500" />
                            Task Playlist
                        </h2>
                        <p className="text-xs text-gray-500">Drag to reorder • Add breaks</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={points.map(p => p.id)} strategy={verticalListSortingStrategy}>
                            <div className="pb-20">
                                {points.length === 0 && (
                                    <div className="text-center py-10 text-gray-400">
                                        <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                        <p>Playlist is empty</p>
                                    </div>
                                )}
                                
                                {/* Start Insertion Point */}
                                <div className="flex justify-center mb-2 opacity-0 hover:opacity-100 transition-opacity">
                                     <button 
                                        onClick={() => onInsertTask(0)} 
                                        className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-sm hover:scale-105 transition-transform"
                                     >
                                         <Plus className="w-3 h-3" /> Insert at Start
                                     </button>
                                </div>

                                {points.map((point, index) => (
                                    <SortableItem 
                                        key={point.id} 
                                        point={point} 
                                        index={index} 
                                        onEdit={onEditTask} 
                                        onDelete={onDeleteTask}
                                        onInsertTask={onInsertTask}
                                        onAddDivider={onAddDivider}
                                    />
                                ))}

                                {/* End Insertion Points */}
                                <div className="mt-4 flex flex-col gap-2">
                                    <button 
                                        onClick={() => onInsertTask(points.length)}
                                        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 font-bold hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" /> Add New Task
                                    </button>
                                    <button 
                                        onClick={() => onInsertTask(points.length)} // Simplified logic: generic insert triggers AI choice
                                        className="w-full py-3 bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-xl font-bold hover:bg-violet-200 dark:hover:bg-violet-900/40 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Wand2 className="w-5 h-5" /> Generate Tasks with AI
                                    </button>
                                </div>
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    );
};

export default TaskPlaylistModal;