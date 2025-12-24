
import React, { useState, useEffect } from 'react';
import { PlaygroundTemplate } from '../types';
import * as db from '../services/db';
import { X, Plus, Globe, Trash2, Edit2, LayoutGrid, Image as ImageIcon, Loader2 } from 'lucide-react';

interface PlaygroundManagerProps {
  onClose: () => void;
  onEdit: (template: PlaygroundTemplate) => void;
  onCreate: () => void;
}

const PlaygroundManager: React.FC<PlaygroundManagerProps> = ({ onClose, onEdit, onCreate }) => {
  const [templates, setTemplates] = useState<PlaygroundTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const data = await db.fetchPlaygroundLibrary();
    setTemplates(data);
    setLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this global playground template?')) {
          await db.deletePlaygroundTemplate(id);
          setTemplates(prev => prev.filter(t => t.id !== id));
      }
  };

  return (
    <div className="fixed inset-0 z-[4500] bg-slate-950 text-white flex flex-col font-sans overflow-hidden animate-in fade-in">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)] opacity-40 pointer-events-none" />
        
        {/* Header */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-xl z-10">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
                    <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight uppercase leading-none">GLOBAL PLAYGROUNDS</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">TEMPLATE LIBRARY</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-0">
            <div className="max-w-[1920px] mx-auto">
                <div className="mb-8">
                    <button 
                        onClick={onCreate}
                        className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center gap-3 text-slate-500 hover:text-indigo-500 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group hover:scale-[1.01]"
                    >
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 group-hover:border-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all group-hover:scale-110">
                            <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-black uppercase tracking-widest text-sm">CREATE NEW TEMPLATE</span>
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">LOADING LIBRARY...</span>
                    </div>
                ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                        <LayoutGrid className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-black uppercase tracking-[0.2em] text-sm">NO TEMPLATES FOUND</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {templates.map(tpl => (
                            <div 
                                key={tpl.id}
                                onClick={() => onEdit(tpl)}
                                className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col relative hover:-translate-y-2 hover:scale-[1.01]"
                            >
                                <div className="h-40 bg-slate-800 relative overflow-hidden group-hover:brightness-110 transition-all">
                                    {tpl.playgroundData.imageUrl ? (
                                        <img src={tpl.playgroundData.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt={tpl.title} />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                            <ImageIcon className="w-12 h-12 text-slate-500" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-white/10 shadow-md">
                                        {tpl.tasks.length} TASKS
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(tpl.id, e)}
                                        className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-red-600 rounded-lg text-white transition-all border border-white/10 opacity-0 group-hover:opacity-100 hover:scale-110"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="p-5 flex-1 flex flex-col justify-end">
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight mb-1 truncate group-hover:text-indigo-400 transition-colors">{tpl.title}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        Created: {new Date(tpl.createdAt).toLocaleDateString()}
                                    </p>
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                        <Edit2 className="w-3 h-3" /> EDIT TEMPLATE
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

export default PlaygroundManager;
