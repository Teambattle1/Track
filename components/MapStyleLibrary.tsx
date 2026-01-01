import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Eye, Map as MapIcon, Globe, Layers, Snowflake, Mountain, ScrollText, Settings, Check, AlertTriangle, Edit2, Upload, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { MapStyleId } from '../types';
import * as db from '../services/db';
import { uploadImage } from '../services/storage';

interface MapStyleLibraryProps {
    onClose: () => void;
}

interface CustomMapStyle {
    id: string;
    name: string;
    json: string;
    previewUrl?: string;
    createdBy?: string;
    createdAt?: number;
}

// Hardcoded map styles that ship with the app
const BUILTIN_MAP_STYLES: { id: MapStyleId; label: string; icon: any; preview: string; className?: string; deletable: boolean; description: string }[] = [
    { id: 'osm', label: 'Standard', icon: Globe, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', deletable: false, description: 'Classic OpenStreetMap style with clear roads and labels' },
    { id: 'satellite', label: 'Satellite', icon: Layers, preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/2722/4285', deletable: false, description: 'High-resolution satellite imagery from Esri' },
    { id: 'dark', label: 'Dark Mode', icon: MapIcon, preview: 'https://a.basemaps.cartocdn.com/dark_all/13/4285/2722.png', deletable: true, description: 'Dark theme perfect for night games and reduced eye strain' },
    { id: 'historic', label: 'Historic', icon: ScrollText, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'sepia-[.7] contrast-125 brightness-90', deletable: true, description: 'Vintage sepia-toned map with aged paper texture' },
    { id: 'winter', label: 'Winter', icon: Mountain, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'brightness-125 hue-rotate-180 saturate-50', deletable: true, description: 'Cold winter theme with icy blue tones' },
    { id: 'ski', label: 'Ski Map', icon: Snowflake, preview: 'https://tiles.openskimap.org/map/13/4285/2722.png', deletable: true, description: 'Specialized ski resort and trail map' },
    { id: 'treasure', label: 'Treasure', icon: ScrollText, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'sepia-[.9] contrast-110 brightness-95 hue-rotate-30', deletable: true, description: 'Ancient treasure map style with parchment overlay' },
    { id: 'desert', label: 'Desert', icon: Mountain, preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'saturate-150 hue-rotate-15 brightness-110 contrast-105', deletable: true, description: 'Warm sandy desert tones with enhanced contrast' },
    { id: 'clean', label: 'Clean', icon: Globe, preview: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/13/4285/2722.png', deletable: true, description: 'Minimal clean design for professional presentations' },
];

const MapStyleLibrary: React.FC<MapStyleLibraryProps> = ({ onClose }) => {
    const [customStyles, setCustomStyles] = useState<CustomMapStyle[]>([]);
    const [deletedBuiltinIds, setDeletedBuiltinIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [previewStyle, setPreviewStyle] = useState<string | null>(null);

    // Rename state
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
    const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});
    const [customPreviews, setCustomPreviews] = useState<Record<string, string>>({});

    // Preview editing state
    const [editingPreviewId, setEditingPreviewId] = useState<string | null>(null);
    const [previewUrlInput, setPreviewUrlInput] = useState('');
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [uploadingPreview, setUploadingPreview] = useState(false);

    // Form state for adding new map style
    const [newStyleName, setNewStyleName] = useState('');
    const [newStyleJson, setNewStyleJson] = useState('');
    const [newStylePreview, setNewStylePreview] = useState('');

    useEffect(() => {
        loadCustomStyles();
    }, []);

    const loadCustomStyles = async () => {
        try {
            const styles = await db.fetchCustomMapStyles();
            setCustomStyles(styles);

            // Load deleted builtin IDs from localStorage
            const deleted = localStorage.getItem('deletedMapStyles');
            if (deleted) {
                setDeletedBuiltinIds(new Set(JSON.parse(deleted)));
            }

            // Load custom labels and descriptions
            const labels = localStorage.getItem('mapStyleLabels');
            if (labels) {
                setCustomLabels(JSON.parse(labels));
            }

            const descriptions = localStorage.getItem('mapStyleDescriptions');
            if (descriptions) {
                setCustomDescriptions(JSON.parse(descriptions));
            }

            // Load custom preview URLs
            const previews = localStorage.getItem('mapStylePreviews');
            if (previews) {
                setCustomPreviews(JSON.parse(previews));
            }
        } catch (error) {
            console.error('Error loading custom map styles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStyle = async () => {
        if (!newStyleName.trim()) {
            alert('Please enter a name for the map style');
            return;
        }

        try {
            const newStyle: CustomMapStyle = {
                id: `custom-${Date.now()}`,
                name: newStyleName,
                json: newStyleJson,
                previewUrl: newStylePreview || undefined,
                createdAt: Date.now()
            };

            await db.saveCustomMapStyle(newStyle);
            setCustomStyles([...customStyles, newStyle]);
            
            // Reset form
            setNewStyleName('');
            setNewStyleJson('');
            setNewStylePreview('');
            setShowAddModal(false);
        } catch (error) {
            console.error('Error saving map style:', error);
            alert('Failed to save map style');
        }
    };

    const handleDeleteCustom = async (id: string) => {
        if (!confirm('Delete this custom map style?')) return;

        try {
            await db.deleteCustomMapStyle(id);
            setCustomStyles(customStyles.filter(s => s.id !== id));
        } catch (error) {
            console.error('Error deleting map style:', error);
            alert('Failed to delete map style');
        }
    };

    const handleDeleteBuiltin = (id: string) => {
        if (!confirm(`Hide the "${BUILTIN_MAP_STYLES.find(s => s.id === id)?.label}" map style?\n\nThis will hide it from all dropdowns but won't permanently delete it.`)) return;

        const newDeleted = new Set(deletedBuiltinIds);
        newDeleted.add(id);
        setDeletedBuiltinIds(newDeleted);
        localStorage.setItem('deletedMapStyles', JSON.stringify([...newDeleted]));
    };

    const handleRestoreBuiltin = (id: string) => {
        const newDeleted = new Set(deletedBuiltinIds);
        newDeleted.delete(id);
        setDeletedBuiltinIds(newDeleted);
        localStorage.setItem('deletedMapStyles', JSON.stringify([...newDeleted]));
    };

    const handleRenameBuiltin = (id: string, newLabel: string) => {
        const updatedLabels = { ...customLabels, [id]: newLabel };
        setCustomLabels(updatedLabels);
        localStorage.setItem('mapStyleLabels', JSON.stringify(updatedLabels));
        setRenamingId(null);
    };

    const handleUpdateDescription = (id: string, newDescription: string) => {
        const updatedDescriptions = { ...customDescriptions, [id]: newDescription };
        setCustomDescriptions(updatedDescriptions);
        localStorage.setItem('mapStyleDescriptions', JSON.stringify(updatedDescriptions));
    };

    const getStyleLabel = (style: typeof BUILTIN_MAP_STYLES[0]) => {
        return customLabels[style.id] || style.label;
    };

    const getStyleDescription = (style: typeof BUILTIN_MAP_STYLES[0]) => {
        return customDescriptions[style.id] || style.description;
    };

    const getStylePreview = (style: typeof BUILTIN_MAP_STYLES[0]) => {
        return customPreviews[style.id] || style.preview;
    };

    const handleUpdatePreview = async (id: string, newPreviewUrl: string, file?: File | null) => {
        try {
            setUploadingPreview(true);
            let finalUrl = newPreviewUrl;

            // If a file was provided, upload it to Supabase Storage
            if (file) {
                const uploadedUrl = await uploadImage(file, 'map-style-previews');
                if (uploadedUrl) {
                    finalUrl = uploadedUrl;
                } else {
                    alert('Failed to upload image');
                    setUploadingPreview(false);
                    return;
                }
            }

            const updatedPreviews = { ...customPreviews, [id]: finalUrl };
            setCustomPreviews(updatedPreviews);
            localStorage.setItem('mapStylePreviews', JSON.stringify(updatedPreviews));

            // If this is a custom style, also update in database
            const customStyle = customStyles.find(s => s.id === id);
            if (customStyle) {
                await db.saveCustomMapStyle({
                    ...customStyle,
                    previewUrl: finalUrl
                });
            }

            setEditingPreviewId(null);
            setPreviewUrlInput('');
            setPreviewFile(null);
        } catch (error) {
            console.error('Error updating preview:', error);
            alert('Failed to update preview image');
        } finally {
            setUploadingPreview(false);
        }
    };

    const handleStartEditPreview = (id: string, currentPreview: string) => {
        setEditingPreviewId(id);
        setPreviewUrlInput(currentPreview);
    };

    const visibleBuiltinStyles = BUILTIN_MAP_STYLES.filter(s => !deletedBuiltinIds.has(s.id));
    const hiddenBuiltinStyles = BUILTIN_MAP_STYLES.filter(s => deletedBuiltinIds.has(s.id));

    return (
        <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-950 border border-slate-800 w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-purple-900/20 to-slate-950 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                            <MapIcon className="w-7 h-7 text-purple-500" />
                            MAP STYLE LIBRARY
                        </h2>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">
                            Manage custom map styles • {visibleBuiltinStyles.length} Built-in • {customStyles.length} Custom
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            Loading map styles...
                        </div>
                    ) : (
                        <>
                            {/* Add New Button */}
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="w-full p-4 bg-purple-600 hover:bg-purple-700 border-2 border-purple-500 rounded-xl text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Plus className="w-5 h-5" />
                                Add Custom Map Style
                            </button>

                            {/* Built-in Styles */}
                            <div>
                                <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    Built-in Map Styles
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {visibleBuiltinStyles.map((style) => (
                                        <div
                                            key={style.id}
                                            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-purple-500 transition-all group relative"
                                            title={getStyleDescription(style)}
                                        >
                                            <div className="relative group/preview">
                                                {getStylePreview(style) ? (
                                                    <img
                                                        src={getStylePreview(style)}
                                                        alt={getStyleLabel(style)}
                                                        className={`w-full h-32 object-cover ${style.className || ''}`}
                                                    />
                                                ) : (
                                                    <div className="w-full h-32 bg-slate-800 flex items-center justify-center">
                                                        <MapIcon className="w-12 h-12 text-slate-600" />
                                                    </div>
                                                )}
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    <button
                                                        onClick={() => handleStartEditPreview(style.id, getStylePreview(style))}
                                                        className="p-1.5 bg-black/60 hover:bg-purple-600 rounded-lg text-white transition-colors"
                                                        title="Change preview image"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                    </button>
                                                    {getStylePreview(style) && (
                                                        <button
                                                            onClick={() => setPreviewStyle(getStylePreview(style))}
                                                            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors"
                                                            title="Preview"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {style.deletable && (
                                                        <button
                                                            onClick={() => handleDeleteBuiltin(style.id)}
                                                            className="p-1.5 bg-black/60 hover:bg-red-600 rounded-lg text-white transition-colors"
                                                            title="Hide style"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                {renamingId === style.id ? (
                                                    <input
                                                        type="text"
                                                        defaultValue={getStyleLabel(style)}
                                                        autoFocus
                                                        onBlur={(e) => handleRenameBuiltin(style.id, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleRenameBuiltin(style.id, e.currentTarget.value);
                                                            } else if (e.key === 'Escape') {
                                                                setRenamingId(null);
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1 bg-slate-800 border border-purple-500 rounded text-white text-sm font-bold outline-none"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <style.icon className="w-4 h-4 text-purple-400" />
                                                        <h4
                                                            className="font-bold text-white text-sm flex-1 cursor-pointer hover:text-purple-400 transition-colors"
                                                            onClick={() => setRenamingId(style.id)}
                                                            title="Click to rename"
                                                        >
                                                            {getStyleLabel(style)}
                                                        </h4>
                                                    </div>
                                                )}
                                                <input
                                                    type="text"
                                                    defaultValue={getStyleDescription(style)}
                                                    onBlur={(e) => handleUpdateDescription(style.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleUpdateDescription(style.id, e.currentTarget.value);
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    placeholder="Add description..."
                                                    className="w-full text-[10px] text-slate-400 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 outline-none px-1 py-0.5 transition-colors"
                                                    title="Click to edit description"
                                                />
                                            </div>
                                            {/* Hover Tooltip */}
                                            <div className="absolute bottom-full left-0 right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                <div className="bg-slate-950 border border-purple-500 rounded-lg p-3 shadow-xl">
                                                    <p className="text-xs text-white font-bold mb-1">{getStyleLabel(style)}</p>
                                                    <p className="text-[10px] text-slate-400">{getStyleDescription(style)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Styles */}
                            {customStyles.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        Custom Map Styles
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {customStyles.map((style) => (
                                            <div key={style.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-cyan-500 transition-all group">
                                                <div className="relative">
                                                    {style.previewUrl ? (
                                                        <img
                                                            src={style.previewUrl}
                                                            alt={style.name}
                                                            className="w-full h-32 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-32 bg-slate-800 flex items-center justify-center">
                                                            <MapIcon className="w-12 h-12 text-slate-600" />
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 right-2 flex gap-1">
                                                        {style.previewUrl && (
                                                            <button
                                                                onClick={() => setPreviewStyle(style.previewUrl!)}
                                                                className="p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-white transition-colors"
                                                                title="Preview"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteCustom(style.id)}
                                                            className="p-1.5 bg-black/60 hover:bg-red-600 rounded-lg text-white transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <h4 className="font-bold text-white text-sm mb-1">{style.name}</h4>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">CUSTOM STYLE</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hidden Styles */}
                            {hiddenBuiltinStyles.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Hidden Map Styles
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {hiddenBuiltinStyles.map((style) => (
                                            <div key={style.id} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden opacity-50 hover:opacity-100 transition-all group">
                                                <div className="relative">
                                                    <img
                                                        src={style.preview}
                                                        alt={style.label}
                                                        className={`w-full h-32 object-cover grayscale ${style.className || ''}`}
                                                    />
                                                    <div className="absolute top-2 right-2">
                                                        <button
                                                            onClick={() => handleRestoreBuiltin(style.id)}
                                                            className="p-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
                                                            title="Restore style"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <h4 className="font-bold text-white text-sm">{style.label}</h4>
                                                    <p className="text-[10px] text-red-400 uppercase tracking-wide">HIDDEN</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Edit Preview URL Modal */}
            {editingPreviewId && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-10">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full">
                        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ImageIcon className="w-6 h-6 text-purple-500" />
                            Update Preview Image
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                                    Preview Tile URL
                                </label>
                                <input
                                    type="text"
                                    value={previewUrlInput}
                                    onChange={(e) => setPreviewUrlInput(e.target.value)}
                                    placeholder="https://example.com/tile/13/4285/2722.png"
                                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    autoFocus
                                />
                                <p className="text-[10px] text-slate-500 mt-2">
                                    Enter a tile server URL for zoom level 13. Example formats:
                                </p>
                                <ul className="text-[10px] text-slate-400 mt-1 space-y-0.5 list-disc list-inside">
                                    <li>OpenStreetMap: https://a.tile.openstreetmap.org/13/4285/2722.png</li>
                                    <li>CartoDB Dark: https://a.basemaps.cartocdn.com/dark_all/13/4285/2722.png</li>
                                    <li>Satellite: https://server.arcgisonline.com/.../tile/13/2722/4285</li>
                                </ul>
                            </div>

                            {previewUrlInput && (
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                                        Preview
                                    </label>
                                    <div className="w-full h-32 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                                        <img
                                            src={previewUrlInput}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><p class="text-red-400 text-xs">Invalid image URL</p></div>';
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => handleUpdatePreview(editingPreviewId, previewUrlInput)}
                                disabled={!previewUrlInput.trim()}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white font-bold uppercase tracking-wide transition-colors"
                            >
                                Update Preview
                            </button>
                            <button
                                onClick={() => {
                                    setEditingPreviewId(null);
                                    setPreviewUrlInput('');
                                }}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold uppercase tracking-wide transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add New Modal */}
            {showAddModal && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-10">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full">
                        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4">Add Custom Map Style</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">Style Name</label>
                                <input
                                    type="text"
                                    value={newStyleName}
                                    onChange={(e) => setNewStyleName(e.target.value)}
                                    placeholder="e.g., Dark Forest"
                                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                                    Google Maps Style JSON (Optional)
                                </label>
                                <textarea
                                    value={newStyleJson}
                                    onChange={(e) => setNewStyleJson(e.target.value)}
                                    placeholder="Paste JSON from Snazzy Maps or Google Maps Platform"
                                    rows={6}
                                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
                                    Preview Image URL (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={newStylePreview}
                                    onChange={(e) => setNewStylePreview(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleAddStyle}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold uppercase tracking-wide transition-colors"
                            >
                                Add Style
                            </button>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold uppercase tracking-wide transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewStyle && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-10" onClick={() => setPreviewStyle(null)}>
                    <div className="max-w-4xl max-h-[80vh]">
                        <img
                            src={previewStyle}
                            alt="Preview"
                            className="w-full h-auto rounded-xl border-4 border-slate-700 shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapStyleLibrary;
