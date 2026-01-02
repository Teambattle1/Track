import React, { useState, useEffect } from 'react';
import { PlaygroundTemplate } from '../types';
import * as db from '../services/db';
import { X, Plus, Globe, Check, Image as ImageIcon, Loader2, ChevronLeft } from 'lucide-react';

interface PlayzoneSelectorProps {
  onClose: () => void;
  onAddToGame: (templates: PlaygroundTemplate[]) => Promise<void>;
  onBack: () => void;
}

const PlayzoneSelector: React.FC<PlayzoneSelectorProps> = ({ onClose, onAddToGame, onBack }) => {
  const [templates, setTemplates] = useState<PlaygroundTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const data = await db.fetchPlaygroundLibrary();
    setTemplates(data);
    setLoading(false);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleAddToGame = async () => {
    if (selectedIds.size === 0) return;
    
    const selectedTemplates = templates.filter(t => selectedIds.has(t.id));
    setIsAdding(true);
    
    try {
      await onAddToGame(selectedTemplates);
      onClose();
    } catch (error) {
      console.error('Error adding playzones to game:', error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[4500] bg-slate-950 text-white flex flex-col font-sans overflow-hidden animate-in fade-in">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)] opacity-40 pointer-events-none" />
      
      {/* Header */}
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-xl z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95"
            title="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase leading-none">SELECT PLAYZONES</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
              {selectedIds.size > 0 ? `${selectedIds.size} SELECTED` : 'CHOOSE PLAYZONES TO ADD'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-0">
        <div className="max-w-[1920px] mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">LOADING PLAYZONES...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
              <Globe className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-black uppercase tracking-[0.2em] text-sm">NO PLAYZONES AVAILABLE</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {templates.map(tpl => {
                const isSelected = selectedIds.has(tpl.id);
                return (
                  <div
                    key={tpl.id}
                    onClick={() => toggleSelection(tpl.id)}
                    className={`group bg-slate-900 border-2 rounded-3xl overflow-hidden shadow-xl transition-all flex flex-col relative cursor-pointer hover:-translate-y-2 hover:scale-[1.01] ${
                      isSelected
                        ? 'border-emerald-500 shadow-emerald-500/20'
                        : 'border-slate-800 hover:border-emerald-500/50 hover:shadow-emerald-500/10'
                    }`}
                  >
                    {/* Card Body */}
                    <div>
                      <div className="h-40 bg-slate-800 relative overflow-hidden group-hover:brightness-110 transition-all">
                        {tpl.playgroundData.imageUrl ? (
                          <img
                            src={tpl.playgroundData.imageUrl}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                            alt={tpl.title}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center opacity-30">
                            <ImageIcon className="w-12 h-12 text-slate-500" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-white/10 shadow-md">
                          {tpl.tasks.length} TASKS
                        </div>

                        {/* Selection Checkbox */}
                        <div className={`absolute top-3 right-3 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-500 shadow-lg'
                            : 'bg-slate-800/50 border-slate-600 group-hover:border-emerald-500'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-end">
                        <h3 className={`text-lg font-black uppercase tracking-tight leading-tight mb-1 truncate transition-colors ${
                          isSelected ? 'text-emerald-400' : 'text-white group-hover:text-emerald-400'
                        }`}>
                          {tpl.title}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Created: {new Date(tpl.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer with Action Button */}
      <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end items-center gap-3 shadow-xl">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all border border-slate-700"
        >
          Cancel
        </button>
        <button
          onClick={handleAddToGame}
          disabled={selectedIds.size === 0 || isAdding}
          className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all ${
            selectedIds.size === 0 || isAdding
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:scale-105 active:scale-95'
          }`}
        >
          {isAdding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              ADDING...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              ADD {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} TO GAME
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PlayzoneSelector;
