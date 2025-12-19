import React, { useState } from 'react';
import { GamePoint } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { Edit2, Trash2, X } from 'lucide-react';

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
    <div className="absolute bottom-24 left-4 right-4 z-[500] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 border border-gray-100 dark:border-gray-800 flex items-center gap-4 relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white dark:bg-gray-800 text-gray-400 p-1.5 rounded-full shadow-md border border-gray-100 dark:border-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
          <Icon className="w-6 h-6" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-white truncate">{point.title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stripHtml(point.task.question)}</p>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-medium uppercase tracking-wide">
               {point.task.type.replace('_', ' ')}
             </span>
             <span className="text-[10px] text-gray-400">
               Radius: {point.radiusMeters}m
             </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onDelete}
            className="p-3 text-red-500 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-colors"
            title="Delete Task"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button 
            onClick={onEdit}
            className="p-3 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 dark:shadow-none transition-colors"
            title="Edit Details"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskPreview;