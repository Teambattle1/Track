import React, { useState, useMemo } from 'react';
import {
  X, Tag, Plus, Trash2, Palette, Search, Hash,
  ChevronDown, AlertCircle, Check, RotateCcw, Info,
  Database, Zap, Eye, Loader2, Save
} from 'lucide-react';
import { Game, TaskTemplate } from '../types';
import { useTagColors } from '../contexts/TagColorsContext';

const TAG_COLORS = [
  '#64748b', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
  '#475569', '#dc2626', '#ea580c', '#d97706', '#65a30d', '#059669', '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#e11d48',
  '#334155', '#991b1b', '#9a3412', '#92400e', '#3f6212', '#065f46', '#155e75', '#1e40af', '#5b21b6', '#86198f', '#9f1239'
];

type TagMutationProgress = (progress: number, label: string) => void;

interface AccountTagsProps {
    games?: Game[];
    library?: TaskTemplate[];
    onDeleteTagGlobally?: (tagName: string, onProgress?: TagMutationProgress) => Promise<void>;
    onRenameTagGlobally?: (oldTag: string, newTag: string, onProgress?: TagMutationProgress) => Promise<void>;
}

const AccountTags: React.FC<AccountTagsProps> = ({ games = [], library = [], onDeleteTagGlobally, onRenameTagGlobally }) => {
    const { tagColors, replaceTagColors } = useTagColors();
    const [newTagName, setNewTagName] = useState('');
    const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showTagNameSuggestions, setShowTagNameSuggestions] = useState(false);

    // Edit / Rename State
    const [editingOldName, setEditingOldName] = useState<string | null>(null);

    // Bulk Selection State
    const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
    const [selectedTagsForBulk, setSelectedTagsForBulk] = useState<Set<string>>(new Set());
    const [bulkDeleteTarget, setBulkDeleteTarget] = useState<string[] | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [bulkDeleteProgress, setBulkDeleteProgress] = useState(0);
    const [bulkDeleteLabel, setBulkDeleteLabel] = useState('');

    // Actions State
    const [purgeTarget, setPurgeTarget] = useState<string | null>(null);
    const [isPurging, setIsPurging] = useState(false);
    const [purgeProgress, setPurgeProgress] = useState(0);
    const [purgeLabel, setPurgeLabel] = useState('');
    const [isSaving, setIsSaving] = useState(false);


    const saveTags = (newTags: Record<string, string>) => {
        replaceTagColors(newTags);
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
                        await onRenameTagGlobally(editingOldName, name, (progress, label) => {
                            setPurgeLabel(label);
                            setPurgeProgress(progress);
                        });
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
            setPurgeProgress(0);
            setPurgeLabel('');
            setIsPurging(false);
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

    const handleToggleBulkSelection = (tagName: string) => {
        const newSet = new Set(selectedTagsForBulk);
        if (newSet.has(tagName)) {
            newSet.delete(tagName);
        } else {
            newSet.add(tagName);
        }
        setSelectedTagsForBulk(newSet);
    };

    const handleSelectAllVisibleTags = (displayedTags: string[]) => {
        setSelectedTagsForBulk(new Set(displayedTags));
    };

    const handleDeselectAllTags = () => {
        setSelectedTagsForBulk(new Set());
    };

    const handleStartBulkDelete = () => {
        if (selectedTagsForBulk.size === 0) return;
        setBulkDeleteTarget(Array.from(selectedTagsForBulk));
    };

    const handleConfirmBulkDelete = async () => {
        if (!bulkDeleteTarget || !onDeleteTagGlobally) return;
        setIsBulkDeleting(true);
        setBulkDeleteProgress(0);
        setBulkDeleteLabel('Starting bulk deletion...');

        try {
            for (let i = 0; i < bulkDeleteTarget.length; i++) {
                const tagName = bulkDeleteTarget[i];
                console.log(`[AccountTags] Deleting tag ${i + 1}/${bulkDeleteTarget.length}: "${tagName}"`);

                const inUse = inUseTagsCountMap[tagName] || 0;
                if (inUse > 0) {
                    await onDeleteTagGlobally(tagName, (progress, label) => {
                        // Calculate overall progress
                        const overallProgress = (i + progress) / bulkDeleteTarget.length;
                        setBulkDeleteProgress(overallProgress);
                        setBulkDeleteLabel(`Deleting "${tagName}"... ${label}`);
                    });
                } else {
                    // Just remove from registry
                    const next = { ...tagColors };
                    delete next[tagName];
                    delete next[tagName.toLowerCase()];
                    replaceTagColors(next);
                    const overallProgress = (i + 1) / bulkDeleteTarget.length;
                    setBulkDeleteProgress(overallProgress);
                    setBulkDeleteLabel(`Removed "${tagName}" from registry`);
                }
            }

            console.log(`[AccountTags] Bulk delete complete`);
            setBulkDeleteTarget(null);
            setSelectedTagsForBulk(new Set());
            setBulkSelectionMode(false);
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert(`Failed to delete tags. Please try again.\n\nError: ${error}`);
        } finally {
            setIsBulkDeleting(false);
            setBulkDeleteLabel('');
            setBulkDeleteProgress(0);
        }
    };

    const handleConfirmPurge = async () => {
        if (!purgeTarget || !onDeleteTagGlobally) return;
        setIsPurging(true);
        setPurgeProgress(0);
        setPurgeLabel('Starting purge...');
        const tagToPurge = purgeTarget;

        try {
            console.log(`[AccountTags] Starting global purge of tag: "${tagToPurge}"`);

            // Delete from database FIRST (all tasks/games)
            await onDeleteTagGlobally(tagToPurge, (progress, label) => {
                setPurgeProgress(progress);
                setPurgeLabel(label);
            });

            console.log(`[AccountTags] Database purge complete for: "${tagToPurge}"`);

            setPurgeProgress(1);
            setPurgeLabel('Finalizing...');

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
            setPurgeLabel('');
            setPurgeProgress(0);
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

    const tagNameSuggestions = useMemo(() => {
        if (editingOldName) return [];
        const q = newTagName.trim().toLowerCase();
        if (!q) return [];

        return displayTags
            .filter(t => t.toLowerCase().includes(q))
            .filter(t => t.toLowerCase() !== q)
            .slice(0, 8);
    }, [displayTags, editingOldName, newTagName]);

    const purgeProgressPercent = isPurging
        ? Math.min(100, Math.max(2, Math.round(purgeProgress * 100)))
        : 0;

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
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">TAG NAME</label>
                                <input
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => { setNewTagName(e.target.value); setShowTagNameSuggestions(true); }}
                                    onFocus={() => setShowTagNameSuggestions(true)}
                                    onBlur={() => window.setTimeout(() => setShowTagNameSuggestions(false), 150)}
                                    placeholder="E.G. HISTORICAL..."
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-[#00adef] transition-all uppercase placeholder:text-gray-700 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTag()}
                                />

                                {!editingOldName && showTagNameSuggestions && tagNameSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-2 bg-[#111111] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                                        {tagNameSuggestions.map((suggestion) => {
                                            const isRegistered = !!tagColors[suggestion];
                                            const isInUse = inUseTags.includes(suggestion);
                                            const useCount = inUseTagsCountMap[suggestion] || 0;

                                            return (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        handleEditTagClick(suggestion, tagColors[suggestion]);
                                                        setShowTagNameSuggestions(false);
                                                    }}
                                                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-white uppercase tracking-wider truncate">{suggestion}</span>
                                                            {!isRegistered && (
                                                                <span className="text-[8px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">NOT REGISTERED</span>
                                                            )}
                                                            {isInUse && (
                                                                <span className="text-[8px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">{useCount} IN USE</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[9px] text-gray-600 font-mono mt-0.5 uppercase">CLICK TO EDIT</p>
                                                    </div>

                                                    <div
                                                        className="w-4 h-4 rounded border border-white/10 shrink-0"
                                                        style={{ backgroundColor: tagColors[suggestion] || '#1f2937' }}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
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
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">MANAGEMENT REGISTRY</h2>
                                <button
                                    onClick={() => {
                                        setBulkSelectionMode(!bulkSelectionMode);
                                        if (bulkSelectionMode) {
                                            setSelectedTagsForBulk(new Set());
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${bulkSelectionMode ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                >
                                    {bulkSelectionMode ? '✓ BULK MODE' : '+ ADD/REMOVE TAGS'}
                                </button>
                            </div>
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

                        {bulkSelectionMode && selectedTagsForBulk.size > 0 && (
                            <div className="px-6 py-4 bg-orange-900/20 border-b border-orange-500/20 flex items-center justify-between">
                                <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">
                                    {selectedTagsForBulk.size} TAG{selectedTagsForBulk.size !== 1 ? 'S' : ''} SELECTED
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDeselectAllTags}
                                        className="px-3 py-1.5 bg-orange-950 hover:bg-orange-900 text-orange-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        DESELECT ALL
                                    </button>
                                    <button
                                        onClick={handleStartBulkDelete}
                                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                    >
                                        <Trash2 className="w-3 h-3" /> DELETE {selectedTagsForBulk.size}
                                    </button>
                                </div>
                            </div>
                        )}

                        {bulkSelectionMode && (
                            <div className="px-6 py-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                                <button
                                    onClick={() => handleSelectAllVisibleTags(displayTags)}
                                    className="text-[10px] font-black text-[#00adef] uppercase tracking-widest hover:underline"
                                >
                                    SELECT ALL SHOWN
                                </button>
                            </div>
                        )}

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
                                    const isSelected = selectedTagsForBulk.has(name);

                                    return (
                                        <div
                                            key={name}
                                            onClick={() => bulkSelectionMode ? handleToggleBulkSelection(name) : handleEditTagClick(name, color)}
                                            className={`px-6 py-4 flex items-center justify-between transition-colors group cursor-pointer border-l-4 ${isSelected ? 'bg-orange-900/20 border-orange-500' : isEditing ? 'bg-white/[0.05] border-orange-500' : 'hover:bg-white/[0.02] border-transparent'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                {bulkSelectionMode && (
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleBulkSelection(name)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-5 h-5 rounded border-orange-500 accent-orange-600 cursor-pointer"
                                                    />
                                                )}
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
                                                {!bulkSelectionMode && (
                                                    <>
                                                        {isEditing && <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest animate-pulse">EDITING</span>}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveTagClick(name); }}
                                                            className="p-2.5 rounded-lg transition-all bg-red-950/20 text-red-500/50 hover:text-red-500 hover:bg-red-950/50"
                                                            title={isInUse ? "GLOBAL PURGE" : "REMOVE FROM REGISTRY"}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
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
                        <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed mb-6">
                            THE TAG <span className="text-white font-black">"{purgeTarget.toUpperCase()}"</span> IS CURRENTLY USED IN <span className="text-orange-500 font-black">{inUseTagsCountMap[purgeTarget]} TASKS</span>.
                            <br/><br/>
                            THIS WILL STRIP THE TAG FROM EVERY ITEM IN THE DATABASE. THIS CANNOT BE UNDONE.
                        </p>

                        <div className={`mb-8 transition-opacity ${isPurging ? 'opacity-100' : 'opacity-60'}`} aria-live="polite">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                    {isPurging ? (purgeLabel || 'PURGING...') : 'READY'}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                    {isPurging ? `${Math.round(purgeProgress * 100)}%` : '0%'}
                                </span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                                <div
                                    className="h-full bg-red-600 rounded-full transition-all duration-300 w-[var(--purge-progress)]"
                                    style={{ ['--purge-progress' as any]: `${purgeProgressPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => { setPurgeTarget(null); setPurgeLabel(''); setPurgeProgress(0); }}
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
