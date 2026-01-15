import React, { useState } from 'react';
import { ZoneChangeEvent } from '../types';
import { 
    MapPin, Clock, ChevronUp, ChevronDown, Trash2, 
    Eye, EyeOff, Upload, Image as ImageIcon,
    Check, Code as CodeIcon, ChevronRight
} from 'lucide-react';
import { uploadImage } from '../services/storage';
import DOMPurify from 'dompurify';

interface ZoneChangeCardProps {
    zoneChange: ZoneChangeEvent;
    index: number;
    onUpdate: (updates: Partial<ZoneChangeEvent>) => void;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}

const ZoneChangeCard: React.FC<ZoneChangeCardProps> = ({
    zoneChange,
    index,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [useSimpleEditor, setUseSimpleEditor] = useState(true);
    const [simpleTitle, setSimpleTitle] = useState('');
    const [simpleMessage, setSimpleMessage] = useState('');

    const handleDateTimeChange = (dateString?: string, timeString?: string) => {
        const currentDate = zoneChange.targetTime ? new Date(zoneChange.targetTime) : new Date();

        // Use provided values or fall back to current values
        const dateToUse = dateString || getDateString();
        const timeToUse = timeString || getTimeString();

        if (!dateToUse || !timeToUse) {
            // If either is cleared, keep current targetTime
            return;
        }

        // Parse date (YYYY-MM-DD)
        const [year, month, day] = dateToUse.split('-').map(Number);
        // Parse time (HH:MM)
        const [hours, minutes] = timeToUse.split(':').map(Number);

        // Create target date with both date and time
        const target = new Date(year, month - 1, day, hours, minutes, 0, 0);

        onUpdate({ targetTime: target.getTime() });
    };

    const handleTimeChange = (timeString: string) => {
        if (!timeString) return;
        handleDateTimeChange(undefined, timeString);
    };

    const handleDateChange = (dateString: string) => {
        if (!dateString) return;
        handleDateTimeChange(dateString, undefined);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            const url = await uploadImage(file);
            if (url) onUpdate({ imageUrl: url });
        } catch (error) {
            console.error('Image upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const getTimeString = () => {
        if (!zoneChange.targetTime) return '';
        const date = new Date(zoneChange.targetTime);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const getDateString = () => {
        if (!zoneChange.targetTime) {
            // Default to today
            const today = new Date();
            return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        }
        const date = new Date(zoneChange.targetTime);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    };

    const getTimeRemaining = () => {
        if (!zoneChange.targetTime) return 'Not set';
        const now = Date.now();
        const diff = zoneChange.targetTime - now;
        if (diff < 0) return 'Passed';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        }
        return `${hours}h ${minutes}m`;
    };

    const getFormattedDateTime = () => {
        if (!zoneChange.targetTime) return 'No date/time set';
        const date = new Date(zoneChange.targetTime);
        const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        return `${dateStr} at ${timeStr}`;
    };

    const convertSimpleToHtml = (title: string, message: string) => {
        let html = '';
        if (title.trim()) {
            html += `<h2>${DOMPurify.sanitize(title)}</h2>`;
        }
        if (message.trim()) {
            const paragraphs = message.split('\n\n').map(p => {
                const sanitized = DOMPurify.sanitize(p.trim());
                return `<p>${sanitized}</p>`;
            }).join('');
            html += paragraphs;
        }
        return html;
    };

    const handleApplySimpleEditor = () => {
        const html = convertSimpleToHtml(simpleTitle, simpleMessage);
        onUpdate({ message: html });
        setUseSimpleEditor(false);
    };

    return (
        <div className={`bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all ${
            zoneChange.enabled 
                ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
                : 'border-slate-700'
        }`}>
            {/* Header */}
            <div className="p-4 flex items-center gap-3">
                {/* Order Controls */}
                <div className="flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={!onMoveUp}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed text-slate-400"
                        title="Move Up"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={!onMoveDown}
                        className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed text-slate-400"
                        title="Move Down"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>

                {/* Number Badge */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
                    zoneChange.enabled 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-slate-800 text-slate-500'
                }`}>
                    {index + 1}
                </div>

                {/* Title & Time */}
                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={zoneChange.title}
                        onChange={(e) => onUpdate({ title: e.target.value })}
                        placeholder="e.g., Switch to Park Zone"
                        className="w-full bg-transparent border-none text-white font-bold text-lg outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1"
                    />
                    <p className="text-xs text-slate-500 px-2">
                        {zoneChange.targetTime ? (
                            <>{getFormattedDateTime()} • {getTimeRemaining()} remaining</>
                        ) : (
                            'No date/time set'
                        )}
                    </p>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center gap-2 shrink-0">
                    {zoneChange.hasTriggered && (
                        <div className="px-3 py-1 bg-green-900 border border-green-700 rounded-lg text-xs font-bold text-green-300">
                            TRIGGERED
                        </div>
                    )}
                    {zoneChange.showOnTeamView && (
                        <span title="Visible to teams">
                            <Eye className="w-4 h-4 text-blue-400" />
                        </span>
                    )}
                </div>

                {/* Toggle Enable */}
                <label 
                    className="flex items-center gap-2 cursor-pointer shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onUpdate({ enabled: !zoneChange.enabled });
                    }}
                >
                    <div className={`w-12 h-7 rounded-full transition-all ${
                        zoneChange.enabled ? 'bg-orange-600' : 'bg-slate-700'
                    }`}>
                        <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${
                            zoneChange.enabled ? 'translate-x-6' : 'translate-x-0.5'
                        } translate-y-0.5`} />
                    </div>
                </label>

                {/* Expand/Collapse */}
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 shrink-0"
                    title={isExpanded ? "Collapse" : "Expand"}
                >
                    <ChevronRight className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Delete */}
                <button
                    type="button"
                    onClick={() => {
                        if (confirm(`Delete "${zoneChange.title}"?`)) {
                            onDelete();
                        }
                    }}
                    className="p-2 hover:bg-red-900 rounded-lg text-red-400 hover:text-red-300 shrink-0"
                    title="Delete"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

            {/* Expanded Configuration */}
            {isExpanded && (
                <div className="border-t border-slate-700 p-6 space-y-6 bg-slate-950">
                    {/* Date & Time Configuration */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Countdown Target Date & Time
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={getDateString()}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Time</label>
                                <input
                                    type="time"
                                    value={getTimeString()}
                                    onChange={(e) => handleTimeChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Countdown will reach 00:00 at this date and time.
                        </p>
                    </div>

                    {/* Show on Team View */}
                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700">
                        <div>
                            <label className="text-sm font-bold text-white">Show Countdown to Teams</label>
                            <p className="text-xs text-slate-500 mt-1">
                                Display countdown timer in team dashboard topbar
                            </p>
                        </div>
                        <label 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdate({ showOnTeamView: !zoneChange.showOnTeamView });
                            }}
                        >
                            <div className={`w-12 h-7 rounded-full transition-all ${
                                zoneChange.showOnTeamView ? 'bg-blue-600' : 'bg-slate-700'
                            }`}>
                                <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${
                                    zoneChange.showOnTeamView ? 'translate-x-6' : 'translate-x-0.5'
                                } translate-y-0.5`} />
                            </div>
                        </label>
                    </div>

                    {/* Message - Simple or HTML Editor */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-xs font-bold text-slate-400 uppercase">
                                Popup Message
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(true)}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                >
                                    <Eye className="w-3 h-3" />
                                    PREVIEW
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUseSimpleEditor(!useSimpleEditor)}
                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    {useSimpleEditor ? 'HTML MODE' : 'SIMPLE MODE'}
                                </button>
                            </div>
                        </div>

                        {useSimpleEditor ? (
                            // Simple Editor for Non-Technical Admins
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Title (Heading)</label>
                                    <input
                                        type="text"
                                        value={simpleTitle}
                                        onChange={(e) => setSimpleTitle(e.target.value)}
                                        placeholder="e.g., Zone Change!"
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Message (you can use line breaks)</label>
                                    <textarea
                                        value={simpleMessage}
                                        onChange={(e) => setSimpleMessage(e.target.value)}
                                        rows={4}
                                        placeholder="Describe what teams should do. Leave a blank line between paragraphs."
                                        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleApplySimpleEditor}
                                    className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    APPLY MESSAGE
                                </button>
                                <p className="text-xs text-slate-600">
                                    Simple mode automatically formats your text into a nice popup message.
                                </p>
                            </div>
                        ) : (
                            // Advanced HTML Editor
                            <div className="space-y-3">
                                <textarea
                                    value={zoneChange.message}
                                    onChange={(e) => onUpdate({ message: e.target.value })}
                                    rows={6}
                                    placeholder="<h2>Time to Move!</h2><p>Head to the park zone now.</p>"
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                <p className="text-xs text-slate-500">
                                    Use HTML for formatting (e.g., &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;)
                                </p>
                            </div>
                        )}

                        {/* Inline Preview */}
                        {zoneChange.message && !useSimpleEditor && (
                            <div className="mt-3 p-4 bg-slate-800 border border-slate-600 rounded-xl">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Preview:</p>
                                <div
                                    className="text-sm text-slate-200 prose prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(zoneChange.message) }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Full Screen Preview Modal */}
                    {showPreview && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border-2 border-orange-500 rounded-2xl max-w-md w-full max-h-[80vh] overflow-auto shadow-2xl">
                                {/* Preview Header */}
                                <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4 flex items-center justify-between sticky top-0">
                                    <h3 className="text-white font-bold uppercase flex items-center gap-2">
                                        <MapPin className="w-5 h-5" />
                                        Zone Change Popup
                                    </h3>
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="text-white hover:bg-orange-800 p-1 rounded transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Preview Content */}
                                <div className="p-6">
                                    {/* Image if exists */}
                                    {zoneChange.imageUrl && (
                                        <img
                                            src={zoneChange.imageUrl}
                                            alt="Zone Change"
                                            className="w-full h-40 object-cover rounded-lg mb-4"
                                        />
                                    )}

                                    {/* Message */}
                                    <div
                                        className="text-white prose prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(zoneChange.message || '<p>No message set</p>') }}
                                    />

                                    {/* Close Button Preview */}
                                    {zoneChange.requireCode ? (
                                        <div className="mt-6 space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Enter code to dismiss"
                                                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-center font-mono"
                                            />
                                            <button className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg">
                                                CONFIRM CODE
                                            </button>
                                        </div>
                                    ) : (
                                        <button className="w-full mt-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg">
                                            GOT IT
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image Upload */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Popup Image (Optional)
                        </label>
                        
                        {zoneChange.imageUrl ? (
                            <div className="relative group">
                                <img 
                                    src={zoneChange.imageUrl} 
                                    alt="Zone Change" 
                                    className="w-full h-48 object-cover rounded-xl border-2 border-slate-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => onUpdate({ imageUrl: undefined })}
                                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        ) : (
                            <label className="block w-full p-8 border-2 border-dashed border-slate-700 hover:border-orange-500 rounded-xl cursor-pointer transition-all text-center bg-slate-900">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                {isUploading ? (
                                    <p className="text-sm text-slate-400">Uploading...</p>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                        <p className="text-sm text-slate-400">Click to upload image</p>
                                        <p className="text-xs text-slate-600 mt-1">JPG, PNG or GIF</p>
                                    </>
                                )}
                            </label>
                        )}
                    </div>

                    {/* Require Code */}
                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700">
                        <div>
                            <label className="text-sm font-bold text-white flex items-center gap-2">
                                <CodeIcon className="w-4 h-4" />
                                Require Code to Dismiss
                            </label>
                            <p className="text-xs text-slate-500 mt-1">
                                Teams must enter code <code className="px-1 py-0.5 bg-slate-800 rounded font-mono text-orange-400">4027</code> to close the popup
                            </p>
                        </div>
                        <label 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdate({ requireCode: !zoneChange.requireCode });
                            }}
                        >
                            <div className={`w-12 h-7 rounded-full transition-all ${
                                zoneChange.requireCode ? 'bg-purple-600' : 'bg-slate-700'
                            }`}>
                                <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${
                                    zoneChange.requireCode ? 'translate-x-6' : 'translate-x-0.5'
                                } translate-y-0.5`} />
                            </div>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZoneChangeCard;
