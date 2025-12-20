
import React from 'react';
import { GamePoint } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { Edit2, Trash2, X, Target, MousePointer2, Award } from 'lucide-react';

interface TaskPreviewProps {
  point: GamePoint;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const TaskPreview: React.FC<TaskPreviewProps> = ({ point, onEdit, onDelete, onClose }) => {
  const Icon = ICON_COMPONENTS[point.iconId];

  // Helper to strip HTML tags for preview
  const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

  return (
    <div className="absolute bottom-24 left-4 right-4 z-[500] flex justify-center pointer-events-none">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header Bar with Pull Indicator */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-2 flex justify-center border-b border-gray-100 dark:border-gray-800">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        <div className="p-5">
            <div className="flex items-start gap-4 mb-4">
                {/* Icon Box */}
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-sm">
                    <Icon className="w-7 h-7" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate pr-2 uppercase">{point.title}</h3>
                        <button onClick={onClose} className="p-1 -mt-1 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-tight mt-1 mb-2">
                        {stripHtml(point.task.question) || "No description set."}
                    </p>
                </div>
            </div>

            {/* Metadata Badges Grid */}
            <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Type</span>
                    <div className="flex items-center gap-1 font-bold text-gray-700 dark:text-gray-300 text-xs mt-0.5">
                        <MousePointer2 className="w-3 h-3" /> {point.task.type === 'multi_select_dropdown' ? 'MULTI' : point.task.type.toUpperCase()}
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Radius</span>
                    <div className="flex items-center gap-1 font-bold text-gray-700 dark:text-gray-300 text-xs mt-0.5">
                        <Target className="w-3 h-3" /> {point.radiusMeters}m
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Score</span>
                    <div className="flex items-center gap-1 font-bold text-orange-600 dark:text-orange-400 text-xs mt-0.5">
                        <Award className="w-3 h-3" /> {point.points}
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex gap-3">
                <button 
                    onClick={onDelete}
                    className="flex-[1] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors uppercase tracking-wide border border-transparent hover:border-red-200 dark:hover:border-red-800"
                >
                    <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button 
                    onClick={onEdit}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-colors uppercase tracking-wide"
                >
                    <Edit2 className="w-4 h-4" /> Edit Task
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TaskPreview;
