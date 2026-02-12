
import React, { useState, useRef } from 'react';
import { Wand2, Camera, RefreshCw, CheckCircle, X, Loader2, Upload, User } from 'lucide-react';
import { generateAvatar } from '../services/ai';
import { uploadImage } from '../services/storage';

interface AvatarCreatorProps {
    onConfirm: (base64: string) => void;
    onCancel?: () => void;
    initialImage?: string | null;
    title?: string;
    placeholder?: string;
    defaultKeywords?: string;
}

const AvatarCreator: React.FC<AvatarCreatorProps> = ({ onConfirm, onCancel, initialImage, title = "CREATE YOUR AGENT", placeholder = "e.g. Cyberpunk ninja cat blue", defaultKeywords = '' }) => {
    const [keywords, setKeywords] = useState(defaultKeywords);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(initialImage || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleGenerate = async () => {
        if (!keywords.trim()) return;
        setIsGenerating(true);
        try {
            const img = await generateAvatar(keywords);
            if (img) setPreviewImage(img);
        } catch (e) {
            alert("Failed to generate avatar. Try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            try {
                // Use storage service to get URL
                const url = await uploadImage(file);
                if (url) setPreviewImage(url);
            } catch (err) {
                console.error("Upload failed", err);
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95">
            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 text-center">
                {title}
            </h3>

            {/* AI Generate — above preview */}
            <div className="space-y-3 mb-4">
                <div>
                    <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                        <Wand2 className="w-3 h-3" /> AI GENERATE
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder={placeholder}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none focus:border-orange-500 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !keywords.trim()}
                            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl transition-colors shadow-lg flex items-center gap-1.5 text-xs font-black uppercase"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            {isGenerating ? '' : 'GO'}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="h-px bg-slate-800 flex-1"></div>
                    <span className="text-[9px] font-black text-slate-600 uppercase">OR</span>
                    <div className="h-px bg-slate-800 flex-1"></div>
                </div>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full py-2.5 border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" /> UPLOAD PHOTO
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>

            {/* Preview — below generate controls */}
            <div className="flex justify-center mb-4">
                <div className="relative w-32 h-32 rounded-full border-4 border-slate-700 bg-slate-800 flex items-center justify-center overflow-hidden shadow-xl group">
                    {previewImage ? (
                        <img src={previewImage} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                        <User className="w-12 h-12 text-slate-600" />
                    )}
                    {(isGenerating || isUploading) && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            {previewImage && (
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => { setPreviewImage(null); setKeywords(defaultKeywords); }}
                        className="py-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/30 rounded-xl text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-3 h-3" /> TRY AGAIN
                    </button>
                    <button
                        onClick={() => onConfirm(previewImage)}
                        className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                    >
                        <CheckCircle className="w-3 h-3" /> CONFIRM
                    </button>
                </div>
            )}

            {!previewImage && onCancel && (
                 <button onClick={onCancel} className="w-full py-2 text-slate-600 hover:text-slate-400 text-xs font-bold uppercase tracking-widest">
                     CANCEL
                 </button>
            )}
        </div>
    );
};

export default AvatarCreator;
