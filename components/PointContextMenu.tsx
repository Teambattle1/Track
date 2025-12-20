
import React from 'react';
import { GamePoint } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { Edit2, RefreshCw, Zap, X } from 'lucide-react';

interface PointContextMenuProps {
  point: GamePoint;
  onEdit: () => void;
  onSwap: () => void;
  onAction: () => void;
  onClose: () => void;
}

const PointContextMenu: React.FC<PointContextMenuProps> = ({ point, onEdit, onSwap, onAction, onClose }) => {
  const Icon = ICON_COMPONENTS[point.iconId];

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white uppercase truncate max-w-[180px]">{point.title}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">SELECT OPTION</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Options */}
        <div className="p-4 flex flex-col gap-3">
            <button 
                onClick={onEdit}
                className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-4 group text-left"
            >
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                    <Edit2 className="w-5 h-5" />
                </div>
                <div>
                    <span className="block font-black text-gray-800 dark:text-gray-100 uppercase tracking-wide">EDIT CONTENT</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Change question, answers, media</span>
                </div>
            </button>

            <button 
                onClick={onSwap}
                className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-4 group text-left"
            >
                <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                    <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                    <span className="block font-black text-gray-800 dark:text-gray-100 uppercase tracking-wide">SWAP FROM LIBRARY</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Replace with existing task template</span>
                </div>
            </button>

            <button 
                onClick={onAction}
                className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-4 group text-left"
            >
                <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5" />
                </div>
                <div>
                    <span className="block font-black text-gray-800 dark:text-gray-100 uppercase tracking-wide">LOGIC & ACTIONS</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Unlock tasks, give points, messages</span>
                </div>
            </button>
        </div>
      </div>
    </div>
  );
};

export default PointContextMenu;
