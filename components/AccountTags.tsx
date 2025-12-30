import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Tag, Plus, Trash2, Palette, Search, Hash, 
  ChevronDown, AlertCircle, Check, RotateCcw, Info,
  Database, Zap, Eye, Loader2, Save
} from 'lucide-react';
import { Game, TaskTemplate } from '../types';

const TAG_COLORS = [
  '#64748b', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  '#475569', '#dc2626', '#ea580c', '#d97706', '#65a30d', '#059669', '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#e11d48',
  '#334155', '#991b1b', '#9a3412', '#92400e', '#3f6212', '#065f46', '#155e75', '#1e40af', '#5b21b6', '#86198f', '#9f1239'
];

interface AccountTagsProps {
    games?: Game[];
    library?: TaskTemplate[];
    onDeleteTagGlobally?: (tagName: string) => Promise<void>;
    onRenameTagGlobally?: (oldTag: string, newTag: string) => Promise<void>;
}

const AccountTags: React.FC<AccountTagsProps> = ({ games = [], library = [], onDeleteTagGlobally, onRenameTagGlobally }) => {
    const [tagColors, setTagColors] = useState<Record<string, string>>({});
    const [newTagName, setNewTagName] = useState('');
    const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Edit / Rename State
    const [editingOldName, setEditingOldName] = useState<string | null>(null);
    
    // Actions State
    const [purgeTarget, setPurgeTarget] = useState<string | null>(null);
    const [isPurging, setIsPurging] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('geohunt_tag_colors');
        if (stored) {
            try {
                setTagColors(JSON.parse(stored));
            } catch (e) { console.error(e); }
        }
    }, []);

    const saveTags = (newTags: Record<string, string>) => {
        setTagColors(newTags);
        localStorage.setItem('geohunt_tag_colors', JSON.stringify(newTags));
    };

    // Scan for tags actually used in the system
    const inUseTagsCountMap = useMemo(() => {
        const map: Record<string, number> = {};
        library.forEach(t => t.tags?.forEach(tag => {
            const low = tag.toLowerCase();
            map[low] = (map[low] || 0) + 1;
        }));
        games.forEach(g => {
            if (g.points && Array.isArray(g.points)) {
                g.points.forEach(p => p.tags?.forEach(tag => {
                    const low = tag.toLowerCase();
                    map[low] = (map[low] || 0) + 1;
                }));
            }
        });
        return map;
    }, [library, games]);

    const inUseTags = Object.keys(inUseTagsCountMap);

    const handleSaveTag = async () => {
        const name = newTagName.trim().toLowerCase();
        if (!name) return;
        setIsSaving(true);

        try {
            if (editingOldName) {
                // UPDATE / RENAME
                if (editingOldName !== name) {
                    // Rename logic
                    if (onRenameTagGlobally) {
                        await onRenameTagGlobally(editingOldName, name);
                    }
                    const next = { ...tagColors };
                    delete next[editingOldName];
                    next[name] = selectedColor;
                    saveTags(next);
                } else {
                    // Just color update
                    saveTags({ ...tagColors, [name]: selectedColor });
                }
                setEditingOldName(null);
            } else {
                // CREATE NEW
                saveTags({ ...tagColors, [name]: selectedColor });
            }
            setNewTagName('');
        } catch (error) {
            console.error("Save tag failed:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditTagClick = (name: string, color: string) => {
        setNewTagName(name.toUpperCase());
        setSelectedColor(color || TAG_COLORS[0]);
        setEditingOldName(name); // Enter edit mode
    };

    const handleCancelEdit = () => {
        setNewTagName('');
        setEditingOldName(null);
    };

    const handleRemoveTagClick = (name: string) => {
        const count = inUseTagsCountMap[name] || 0;
        if (count > 0) {
            setPurgeTarget(name);
        } else {
            // Tag not in use, just remove from registry
            const next = { ...tagColors };
            delete next[name];
            delete next[name.toLowerCase()]; // Also remove lowercase version if it exists
            saveTags(next);
            console.log(`[AccountTags] Removed unused tag "${name}" from registry`);
            if (editingOldName === name || editingOldName?.toLowerCase() === name.toLowerCase()) {
                handleCancelEdit();
            }
        }
    };

    const handleConfirmPurge = async () => {
        if (!purgeTarget || !onDeleteTagGlobally) return;
        setIsPurging(true);
        const tagToPurge = purgeTarget;

        try {
            console.log(`[AccountTags] Starting global purge of tag: "${tagToPurge}"`);

            // Delete from database FIRST (all tasks/games)
            await onDeleteTagGlobally(tagToPurge);

            console.log(`[AccountTags] Database purge complete for: "${tagToPurge}"`);

            // THEN delete from localStorage to complete the operation
            const next = { ...tagColors };
            delete next[tagToPurge];
            delete next[tagToPurge.toLowerCase()]; // Also remove lowercase version if it exists
            saveTags(next);

            console.log(`[AccountTags] Tag "${tagToPurge}" removed from registry`);

            setPurgeTarget(null);
            if (editingOldName === tagToPurge || editingOldName?.toLowerCase() === tagToPurge.toLowerCase()) {
                handleCancelEdit();
            }
        } catch (error) {
            console.error("Tag purge failed:", error);
            alert(`Failed to delete tag "${tagToPurge}". Please try again.\n\nError: ${error}`);
            // Keep purge target so user can retry
        } finally {
            setIsPurging(false);
        }
    };

    // Combined list of registered and discovered tags
    // Only show tags that are configured (in tagColors) OR currently in use (in inUseTags)
    // Deleted tags will not reappear since they're removed from tagColors
    const displayTags = useMemo(() => {
        const combined = new Set<string>();
        // Add all configured tags
        Object.keys(tagColors).forEach(tag => combined.add(tag));
        // Add all in-use tags (so users see tags they're using even if not configured)
        inUseTags.forEach(tag => combined.add(tag));

        return Array.from(combined)
            .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => a.localeCompare(b));
    }, [tagColors, inUseTags, searchQuery]);

    return (
        <div className="max-w-[100%] mx-auto animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-black text-white tracking-tight uppercase">TAG CATEGORIES</h1>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-[#1a1a1a] px-4 py-2 rounded-lg border border-white/5">
                        <Database className="w-4 h-4 text-orange-500" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{inUseTags.length} TAGS IN USE</span>
                    </div>
                    <div className="flex items-center gap-3 bg-[#1a1a1a] px-4 py-2 rounded-lg border border-white/5">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{Object.keys(tagColors).length} CONFIGURED</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Editor Tool */}
                <div className="lg:col-span-4 space-y-6">
                    <div className={`bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-xl transition-colors ${editingOldName ? 'border-orange-500/50' : ''}`}>
                        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                            {editingOldName ? <Palette className="w-5 h-5 text-orange-500" /> : <Plus className="w-5 h-5 text-[#00adef]" />} 
                            {editingOldName ? 'EDIT TAG' : 'DEFINE NEW TAG'}
                        </h2>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">TAG NAME</label>
                                <input 
                                    type="text" 
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    placeholder="E.G. HISTORICAL..."
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-[#00adef] transition-all uppercase placeholder:text-gray-700 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTag()}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">BRAND COLOR</label>
                                <div className="grid grid-cols-10 gap-1.5">
                                    {TAG_COLORS.map(c => (
                                        <button 
                                            key={c} 
                                            onClick={() => setSelectedColor(c)}
                                            className={`w-6 h-6 rounded-md border-2 transition-all ${selectedColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105 opacity-60 hover:opacity-100'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {editingOldName && (
                                    <button 
                                        onClick={handleCancelEdit}
                                        className="flex-1 py-3.5 bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 font-black uppercase text-[11px] tracking-widest rounded-xl transition-all"
                                    >
                                        CANCEL
                                    </button>
                                )}
                                <button 
                                    onClick={handleSaveTag}
                                    disabled={!newTagName.trim() || isSaving}
                                    className={`flex-[2] py-3.5 text-black font-black uppercase text-[11px] tracking-widest rounded-xl transition-all shadow-lg disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-2 ${editingOldName ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#00adef] hover:bg-[#0096ce]'}`}
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingOldName ? 'UPDATE TAG' : 'REGISTER TAG')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-2xl flex items-start gap-4">
                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[10px] text-blue-300 font-black uppercase tracking-widest mb-1">AUTO-DISCOVERY ACTIVE</p>
                            <p className="text-xs text-blue-200/60 leading-relaxed uppercase">
                                THE REGISTRY AUTOMATICALLY DETECTS TAGS USED IN YOUR LIBRARY. CLICK ANY TAG IN THE LIST TO EDIT ITS COLOR OR RENAME IT GLOBALLY.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right: Tag List */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <div className="bg-[#141414] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0a0a0a]">
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">MANAGEMENT REGISTRY</h2>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="FILTER SYSTEM TAGS..."
                                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-lg pl-10 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-[#00adef] transition-all uppercase placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        <div className="divide-y divide-white/5 min-h-[400px]">
                            {displayTags.length === 0 ? (
                                <div className="p-20 text-center flex flex-col items-center gap-4 opacity-30">
                                    <Tag className="w-12 h-12" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">NO TAGS FOUND</p>
                                </div>
                            ) : (
                                displayTags.map(name => {
                                    const color = tagColors[name];
                                    const isRegistered = !!color;
                                    const isInUse = inUseTags.includes(name);
                                    const useCount = inUseTagsCountMap[name] || 0;
                                    const isEditing = editingOldName === name;

                                    return (
                                        <div 
                                            key={name} 
                                            onClick={() => handleEditTagClick(name, color)}
                                            className={`px-6 py-4 flex items-center justify-between transition-colors group cursor-pointer border-l-4 ${isEditing ? 'bg-white/[0.05] border-orange-500' : 'hover:bg-white/[0.02] border-transparent'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-lg border border-white/5 transition-all ${!isRegistered ? 'bg-slate-800 opacity-50' : ''}`} style={{ backgroundColor: color }}>
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className={`font-black text-sm uppercase tracking-wider ${!isRegistered ? 'text-gray-500' : 'text-white'}`}>{name}</h3>
                                                        {!isRegistered && (
                                                            <span className="text-[8px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">NOT REGISTERED</span>
                                                        )}
                                                        {isInUse && (
                                                            <span className="text-[8px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.5 rounded font-black tracking-widest flex items-center gap-1 uppercase" title={`${useCount} tasks use this tag`}><Zap className="w-2 h-2" /> {useCount} IN USE</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] text-gray-600 font-mono mt-0.5 uppercase">{color || '#UNDEFINED'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {isEditing && <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest animate-pulse">EDITING</span>}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveTagClick(name); }}
                                                    className="p-2.5 rounded-lg transition-all bg-red-950/20 text-red-500/50 hover:text-red-500 hover:bg-red-950/50"
                                                    title={isInUse ? "GLOBAL PURGE" : "REMOVE FROM REGISTRY"}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* PURGE CONFIRMATION MODAL */}
            {purgeTarget && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in">
                    <div className="bg-[#111111] border border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-[0_30px_100px_rgba(0,0,0,1)] text-center">
                        <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto border border-red-500/20">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-3 leading-tight">GLOBAL PURGE?</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed mb-10">
                            THE TAG <span className="text-white font-black">"{purgeTarget.toUpperCase()}"</span> IS CURRENTLY USED IN <span className="text-orange-500 font-black">{inUseTagsCountMap[purgeTarget]} TASKS</span>. 
                            <br/><br/>
                            THIS WILL STRIP THE TAG FROM EVERY ITEM IN THE DATABASE. THIS CANNOT BE UNDONE.
                        </p>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setPurgeTarget(null)}
                                disabled={isPurging}
                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all"
                            >
                                CANCEL
                            </button>
                            <button 
                                onClick={handleConfirmPurge}
                                disabled={isPurging}
                                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-2xl shadow-red-600/20 flex items-center justify-center gap-2"
                            >
                                {isPurging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CONFIRM PURGE'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountTags;
