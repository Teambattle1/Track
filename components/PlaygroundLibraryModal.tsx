
import React, { useState, useEffect } from 'react';
import { PlaygroundTemplate } from '../types';
import * as db from '../services/db';
import { X, Globe, Download, Loader2, LayoutGrid, AlertCircle } from 'lucide-react';

interface PlaygroundLibraryModalProps {
  onClose: () => void;
  onImport: (template: PlaygroundTemplate) => void;
}

const PlaygroundLibraryModal: React.FC<PlaygroundLibraryModalProps> = ({ onClose, onImport }) => {
  const [templates, setTemplates] = useState<PlaygroundTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.fetchPlaygroundLibrary().then(data => {
        setTemplates(data);
        setLoading(false);
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[6500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                        <Globe className="w-6 h-6 text-orange-500" /> GLOBAL PLAYGROUNDS
                    </h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-1">IMPORT READY-MADE VIRTUAL ZONES</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-gray-500">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-xs font-bold uppercase">LOADING LIBRARY...</span>
                    </div>
                ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <LayoutGrid className="w-12 h-12 mb-3 opacity-30" />
                        <span className="text-sm font-bold uppercase tracking-wide">NO GLOBAL PLAYGROUNDS FOUND</span>
                        <span className="text-xs mt-1">Create one in the editor and save it as template!</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                                <div className="aspect-video bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                                    {tpl.playgroundData.imageUrl ? (
                                        <img src={tpl.playgroundData.imageUrl} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={tpl.title} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold uppercase">NO IMAGE</div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                                        {tpl.tasks.length} TASKS
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 className="font-bold text-gray-900 dark:text-white uppercase truncate mb-1">{tpl.title}</h3>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-4">{new Date(tpl.createdAt).toLocaleDateString()}</p>
                                    
                                    <div className="mt-auto">
                                        <button 
                                            onClick={() => onImport(tpl)}
                                            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg transition-colors"
                                        >
                                            <Download className="w-4 h-4" /> IMPORT TO GAME
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default PlaygroundLibraryModal;
