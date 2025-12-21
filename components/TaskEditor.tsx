
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GamePoint, IconId, TaskType, PointActivationType, PointCompletionLogic } from '../types';
import { ICON_COMPONENTS } from '../utils/icons';
import { getCroppedImg } from '../utils/image';
import Cropper from 'react-easy-crop';
import { generateAiImage } from '../services/ai';
// Added missing imports for Edit2 and MousePointerClick
import { 
  X, Save, Trash2, Upload, Link, Loader2, CheckCircle, 
  AlignLeft, CheckSquare, ListChecks, ToggleLeft, SlidersHorizontal, 
  Plus, AlertCircle, ZoomIn, Scissors, Image as ImageIcon, Tag, 
  Copy, KeyRound, ChevronDown, ChevronsUpDown, RotateCw, Type, 
  Palette, Bold, Italic, Underline, MonitorPlay, Speaker, MapPin, 
  Settings, Zap, MessageSquare, Clock, Globe, Lock, Check, Wand2, Hash,
  Edit2, MousePointerClick
} from 'lucide-react';

interface TaskEditorProps {
  point: GamePoint;
  onSave: (point: GamePoint) => void;
  onDelete: (pointId: string) => void;
  onClose: () => void;
  onClone?: (point: GamePoint) => void;
  isTemplateMode?: boolean; 
}

const TAG_COLORS = ['#64748b', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
const LANGUAGES = ['English', 'Danish (Dansk)', 'German (Deutsch)', 'Spanish (Español)', 'French (Français)'];

// --- RICH TEXT EDITOR COMPONENT ---
const RichTextEditor = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder?: string }) => {
  const handleCommand = (command: string, val?: string) => {
    document.execCommand(command, false, val || '');
  };

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 transition-shadow bg-white dark:bg-gray-700">
      <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
        <button type="button" onClick={() => handleCommand('bold')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"><Bold className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('italic')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"><Italic className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('underline')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"><Underline className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button type="button" onClick={() => handleCommand('foreColor', '#ef4444')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-red-500 font-bold">A</button>
        <button type="button" onClick={() => handleCommand('foreColor', '#3b82f6')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-blue-500 font-bold">A</button>
      </div>
      <div 
        className="p-3 min-h-[100px] outline-none text-sm text-gray-900 dark:text-white prose dark:prose-invert max-w-none"
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value }}
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
};

const TaskEditor: React.FC<TaskEditorProps> = ({ point, onSave, onDelete, onClose, onClone, isTemplateMode = false }) => {
  const [editedPoint, setEditedPoint] = useState<GamePoint>({ 
    ...point,
    points: point.points || 100,
    shortIntro: point.shortIntro || '',
    activationTypes: point.activationTypes || ['radius'],
    areaColor: point.areaColor || '',
    completionLogic: point.completionLogic || 'remove_any',
    instructorNotes: point.instructorNotes || '',
    task: {
        type: 'text',
        options: [],
        correctAnswers: [],
        range: { min: 0, max: 100, step: 1, correctValue: 50, tolerance: 0 },
        placeholder: '',
        ...point.task
    },
    feedback: {
        correctMessage: 'Correct!',
        showCorrectMessage: true,
        incorrectMessage: 'Incorrect, try again.',
        showIncorrectMessage: true,
        hint: '',
        hintCost: 10,
        ...point.feedback
    },
    settings: {
        timeLimitSeconds: undefined,
        scoreDependsOnSpeed: false,
        language: 'Danish (Dansk)',
        showAnswerStatus: true,
        showCorrectAnswerOnMiss: false,
        ...point.settings
    },
    tags: point.tags || []
  });

  const [activeTab, setActiveTab] = useState<'CONTENT' | 'MEDIA' | 'ACTIVATION' | 'SETTINGS' | 'LOGIC'>('CONTENT');
  const [tagInput, setTagInput] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState(TAG_COLORS[0]);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [knownTags, setKnownTags] = useState<string[]>([]);

  // Image states
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
        const storedColors = localStorage.getItem('geohunt_tag_colors');
        if (storedColors) {
            const parsed = JSON.parse(storedColors);
            setTagColors(parsed);
            setKnownTags(Object.keys(parsed));
        }
    } catch (e) { console.error(e); }
  }, []);

  const handleAddTag = (specificTag?: string, specificColor?: string) => {
      const tagToAdd = (specificTag || tagInput).trim().toLowerCase();
      if (!tagToAdd) return;
      
      if (editedPoint.tags?.includes(tagToAdd)) {
          setTagInput('');
          setShowTagSuggestions(false);
          return;
      }

      const newTags = [...(editedPoint.tags || []), tagToAdd];
      setEditedPoint(prev => ({ ...prev, tags: newTags }));
      
      const colorToUse = specificColor || selectedTagColor;
      const newColors = { ...tagColors, [tagToAdd]: colorToUse };
      setTagColors(newColors);
      localStorage.setItem('geohunt_tag_colors', JSON.stringify(newColors));
      
      if (!knownTags.includes(tagToAdd)) {
          setKnownTags(prev => [...prev, tagToAdd].sort());
      }
      
      setTagInput('');
      setShowTagSuggestions(false);
  };

  const handleRemoveTag = (tag: string) => {
      setEditedPoint(prev => ({ ...prev, tags: prev.tags?.filter(t => t !== tag) || [] }));
  };

  const handleGenerateImage = async () => {
      const prompt = editedPoint.task.question.replace(/<[^>]*>?/gm, '') + " " + editedPoint.title;
      if (!prompt.trim()) return;
      setIsGeneratingImage(true);
      const img = await generateAiImage(prompt);
      if (img) setEditedPoint(prev => ({ ...prev, task: { ...prev.task, imageUrl: img } }));
      setIsGeneratingImage(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedPoint);
  };

  const renderTypeConfig = () => {
    const { type, options } = editedPoint.task;
    const addOption = () => setEditedPoint(prev => ({...prev, task: {...prev.task, options: [...(prev.task.options||[]), `Option ${(prev.task.options?.length||0)+1}`]}}));
    const updateOption = (i: number, val: string) => {
        const newOpts = [...(options||[])]; newOpts[i] = val;
        setEditedPoint({...editedPoint, task: {...editedPoint.task, options: newOpts}});
    };
    const removeOption = (i: number) => {
        const newOpts = [...(options||[])]; newOpts.splice(i, 1);
        setEditedPoint({...editedPoint, task: {...editedPoint.task, options: newOpts}});
    };

    if (type === 'text') {
        return (
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CORRECT ANSWER</label>
                <input type="text" value={editedPoint.task.answer || ''} onChange={(e) => setEditedPoint({...editedPoint, task: {...editedPoint.task, answer: e.target.value}})} className="w-full p-2 border rounded bg-white dark:bg-gray-700"/>
            </div>
        );
    }
    if (type === 'multiple_choice' || type === 'checkbox' || type === 'dropdown') {
        return (
            <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">OPTIONS</label>
                {options?.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                        <input type="text" value={opt} onChange={(e) => updateOption(idx, e.target.value)} className="flex-1 p-2 border rounded bg-white dark:bg-gray-700 text-sm"/>
                        <button type="button" onClick={() => removeOption(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                    </div>
                ))}
                <button type="button" onClick={addOption} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline"><Plus className="w-3 h-3" /> ADD OPTION</button>
            </div>
        );
    }
    return <p className="text-xs text-gray-500 uppercase italic">No specific settings needed for this type.</p>;
  };

  const filteredTags = knownTags.filter(t => 
    t.toLowerCase().includes(tagInput.toLowerCase()) && 
    !editedPoint.tags?.includes(t)
  ).slice(0, 5);

  return (
    <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-white dark:bg-gray-800 sm:rounded-2xl rounded-t-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] relative">
        
        {/* Header */}
        <div className={`p-4 text-white flex justify-between items-center flex-shrink-0 ${isTemplateMode ? 'bg-amber-600' : 'bg-slate-900'}`}>
          <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg"><Edit2 className="w-5 h-5" /></div>
              <h2 className="text-lg font-black uppercase tracking-widest">
                  {isCropping ? 'CROP IMAGE' : 'TASK EDITOR'}
              </h2>
          </div>
          {!isCropping && <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>}
        </div>

        {isCropping && pendingImage ? (
           <div className="flex flex-col h-full bg-black p-4">
              <div className="relative flex-1 rounded-xl overflow-hidden mb-4 border border-gray-700">
                  <Cropper image={pendingImage} crop={crop} zoom={zoom} rotation={rotation} aspect={4/3} onCropChange={setCrop} onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)} onZoomChange={setZoom} onRotationChange={setRotation} />
              </div>
              <div className="flex gap-3">
                  <button onClick={() => { setIsCropping(false); setPendingImage(null); }} className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-bold uppercase tracking-wide">CANCEL</button>
                  <button onClick={async () => {
                      setIsUploading(true);
                      try {
                          const img = await getCroppedImg(pendingImage, croppedAreaPixels, rotation);
                          setEditedPoint({...editedPoint, task: {...editedPoint.task, imageUrl: img}});
                          setIsCropping(false); setPendingImage(null);
                      } catch(e) { console.error(e); }
                      setIsUploading(false);
                  }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-wide">{isUploading ? 'SAVING...' : 'CROP & SAVE'}</button>
              </div>
           </div>
        ) : (
           <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
               
               {/* TABS */}
               <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
                   {[
                       {id: 'CONTENT', label: 'GEN', icon: AlignLeft},
                       {id: 'MEDIA', label: 'IMG', icon: ImageIcon},
                       {id: 'ACTIVATION', label: 'ACT', icon: Zap},
                       {id: 'SETTINGS', label: 'SET', icon: Settings},
                       {id: 'LOGIC', label: 'LOG', icon: MessageSquare},
                   ].map(tab => (
                       <button
                           key={tab.id}
                           type="button"
                           onClick={() => setActiveTab(tab.id as any)}
                           className={`flex-1 py-3 text-[10px] font-black uppercase flex flex-col items-center gap-1 border-b-2 transition-all ${activeTab === tab.id ? 'border-orange-600 text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800' : 'border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                       >
                           <tab.icon className="w-4 h-4" />
                           {tab.label}
                       </button>
                   ))}
               </div>

               {/* SCROLLABLE CONTENT */}
               <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-gray-900">
                   
                   {activeTab === 'CONTENT' && (
                       <div className="space-y-6">
                           <div>
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">INTERNAL TITLE</label>
                               <input type="text" value={editedPoint.title} onChange={(e) => setEditedPoint({ ...editedPoint, title: e.target.value })} className="w-full px-4 py-2 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-orange-500 outline-none transition-all" placeholder="e.g. Statue Quiz"/>
                           </div>
                           <div>
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">TASK DESCRIPTION</label>
                               <RichTextEditor value={editedPoint.task.question} onChange={(html) => setEditedPoint({ ...editedPoint, task: { ...editedPoint.task, question: html } })} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                               <div>
                                   <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">TYPE</label>
                                   <div className="relative">
                                       <select value={editedPoint.task.type} onChange={(e) => setEditedPoint({ ...editedPoint, task: { ...editedPoint.task, type: e.target.value as any } })} className="w-full px-4 py-2.5 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-orange-500 outline-none appearance-none cursor-pointer">
                                           <option value="text">TEXT INPUT</option>
                                           <option value="multiple_choice">QUIZ (MC)</option>
                                           <option value="boolean">YES / NO</option>
                                           <option value="slider">SLIDER</option>
                                           <option value="checkbox">CHECKBOXES</option>
                                           <option value="dropdown">DROPDOWN</option>
                                       </select>
                                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                   </div>
                               </div>
                               <div>
                                   <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">POINTS</label>
                                   <input type="number" value={editedPoint.points} onChange={(e) => setEditedPoint({ ...editedPoint, points: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-orange-500 outline-none transition-all"/>
                               </div>
                           </div>
                           <div className="p-4 bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                               {renderTypeConfig()}
                           </div>
                       </div>
                   )}

                   {activeTab === 'MEDIA' && (
                       <div className="space-y-6">
                           <div>
                               <div className="flex justify-between items-center mb-3">
                                   <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">COVER IMAGE</label>
                                   <div className="flex gap-2">
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-orange-500 hover:text-white transition-all uppercase tracking-wide flex items-center gap-1"><Upload className="w-3 h-3" /> UPLOAD</button>
                                        <button type="button" onClick={handleGenerateImage} disabled={isGeneratingImage} className="text-[10px] font-black px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all uppercase tracking-wide flex items-center gap-1 shadow-md disabled:opacity-50">{isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI GEN</button>
                                   </div>
                               </div>
                               <div className="aspect-video w-full rounded-2xl border-4 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex items-center justify-center relative overflow-hidden group">
                                   {editedPoint.task.imageUrl ? (
                                       <>
                                           <img src={editedPoint.task.imageUrl} className="w-full h-full object-cover" alt="Task Cover" />
                                           <button type="button" onClick={() => setEditedPoint({...editedPoint, task: {...editedPoint.task, imageUrl: undefined}})} className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 className="w-4 h-4"/></button>
                                       </>
                                   ) : (
                                       <div className="text-center opacity-30 group-hover:opacity-50 transition-opacity">
                                           <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                                           <p className="text-[10px] font-black uppercase">Click upload or AI Gen to add image</p>
                                       </div>
                                   )}
                                   <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if(file) {
                                           const reader = new FileReader();
                                           reader.onloadend = () => { setPendingImage(reader.result as string); setIsCropping(true); };
                                           reader.readAsDataURL(file);
                                       }
                                   }} />
                               </div>
                           </div>
                           <div>
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">YOUTUBE / VIMEO URL</label>
                               <input type="url" value={editedPoint.task.videoUrl || ''} onChange={(e) => setEditedPoint({...editedPoint, task: {...editedPoint.task, videoUrl: e.target.value}})} className="w-full px-4 py-2 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-orange-500 outline-none" placeholder="https://youtube.com/watch?v=..."/>
                           </div>
                       </div>
                   )}

                   {activeTab === 'ACTIVATION' && (
                       <div className="space-y-6">
                           <div className="space-y-3">
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">UNLOCK METHODS</label>
                               {[
                                   { id: 'radius', label: 'GPS GEOFENCE', desc: 'Unlocks within physical radius', icon: MapPin },
                                   { id: 'click', label: 'TAP TO OPEN', desc: 'Allows opening from anywhere', icon: MousePointerClick },
                                   { id: 'qr', label: 'QR / BARCODE', desc: 'Player must scan a code', icon: Hash },
                               ].map(method => (
                                   <button
                                       key={method.id}
                                       type="button"
                                       onClick={() => {
                                           const exists = editedPoint.activationTypes.includes(method.id as any);
                                           const newTypes = exists ? editedPoint.activationTypes.filter(t => t !== method.id) : [...editedPoint.activationTypes, method.id as any];
                                           setEditedPoint({...editedPoint, activationTypes: newTypes});
                                       }}
                                       className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 text-left transition-all ${editedPoint.activationTypes.includes(method.id as any) ? 'bg-orange-50 border-orange-500 dark:bg-orange-900/20' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-orange-200'}`}
                                   >
                                       <div className={`p-3 rounded-xl ${editedPoint.activationTypes.includes(method.id as any) ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}><method.icon className="w-6 h-6" /></div>
                                       <div className="flex-1 min-w-0">
                                           <span className="block font-black text-sm uppercase tracking-wide">{method.label}</span>
                                           <span className="text-[10px] text-gray-500 uppercase font-bold">{method.desc}</span>
                                       </div>
                                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${editedPoint.activationTypes.includes(method.id as any) ? 'bg-orange-600 border-orange-600 text-white' : 'border-gray-200'}`}>{editedPoint.activationTypes.includes(method.id as any) && <Check className="w-4 h-4" />}</div>
                                   </button>
                               ))}
                           </div>
                           {editedPoint.activationTypes.includes('radius') && (
                               <div className="p-5 bg-gray-50 dark:bg-gray-850 rounded-2xl border-2 border-gray-100 dark:border-gray-800">
                                   <div className="flex justify-between items-center mb-4">
                                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GEOFENCE RADIUS</label>
                                       <span className="text-xl font-black text-orange-600">{editedPoint.radiusMeters}m</span>
                                   </div>
                                   <input type="range" min="10" max="500" step="5" value={editedPoint.radiusMeters} onChange={(e) => setEditedPoint({...editedPoint, radiusMeters: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600"/>
                               </div>
                           )}
                       </div>
                   )}

                   {/* TAG EDITOR INTEGRATION */}
                   <div className="pt-8 border-t-2 border-gray-100 dark:border-gray-800">
                       <div className="flex items-center justify-between mb-4">
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5" /> TAGS & CATEGORIES
                            </label>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{editedPoint.tags?.length || 0} ACTIVE</span>
                       </div>
                       
                       <div className="bg-gray-50 dark:bg-gray-850 p-5 rounded-3xl border-2 border-gray-100 dark:border-gray-800">
                           {/* Active Tags Display */}
                           <div className="flex flex-wrap gap-2 mb-6">
                               {(editedPoint.tags || []).length === 0 && <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest p-2 italic">NO TAGS ASSIGNED</p>}
                               {editedPoint.tags?.map(tag => (
                                   <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black text-white uppercase shadow-sm animate-in zoom-in-95" style={{backgroundColor: tagColors[tag] || TAG_COLORS[0]}}>
                                       {tag}
                                       <button type="button" onClick={() => handleRemoveTag(tag)} className="p-0.5 hover:bg-white/20 rounded transition-colors"><X className="w-3 h-3"/></button>
                                   </div>
                               ))}
                           </div>

                           <div className="space-y-4">
                               <div className="relative">
                                   <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Plus className="w-4 h-4" /></div>
                                   <input 
                                        type="text" 
                                        value={tagInput} 
                                        onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(e.target.value.length > 0); }}
                                        placeholder="ADD NEW TAG..." 
                                        className="w-full pl-10 pr-12 py-3 rounded-2xl border-2 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-black uppercase tracking-wider focus:border-orange-500 outline-none transition-all shadow-inner" 
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                                   />
                                   <button type="button" onClick={() => handleAddTag()} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-orange-600 text-white rounded-xl flex items-center justify-center hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20"><Plus className="w-5 h-5"/></button>
                                   
                                   {showTagSuggestions && filteredTags.length > 0 && (
                                       <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in slide-in-from-top-2">
                                           {filteredTags.map(tag => (
                                               <button key={tag} type="button" onClick={() => handleAddTag(tag, tagColors[tag])} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-3 border-b last:border-0 border-gray-100 dark:border-gray-700">
                                                   <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tagColors[tag] }} />
                                                   {tag}
                                               </button>
                                           ))}
                                       </div>
                                   )}
                               </div>

                               <div className="pt-2">
                                   <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Palette className="w-3 h-3" /> ASSIGN COLOR</label>
                                   <div className="flex gap-2 flex-wrap">
                                       {TAG_COLORS.map(c => (
                                           <button key={c} type="button" onClick={() => setSelectedTagColor(c)} className={`w-8 h-8 rounded-xl border-4 transition-all ${selectedTagColor === c ? 'border-orange-500 scale-110 shadow-lg' : 'border-white dark:border-gray-700 hover:scale-105'}`} style={{backgroundColor: c}} />
                                       ))}
                                   </div>
                               </div>

                               {knownTags.length > 0 && (
                                   <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-2">
                                       <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">GLOBAL TAG LIBRARY</label>
                                       <div className="flex flex-wrap gap-2">
                                           {knownTags.filter(t => !editedPoint.tags?.includes(t)).slice(0, 8).map(tag => (
                                               <button key={tag} type="button" onClick={() => handleAddTag(tag, tagColors[tag])} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-orange-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all text-gray-500">
                                                   + {tag}
                                               </button>
                                           ))}
                                       </div>
                                   </div>
                               )}
                           </div>
                       </div>
                   </div>
               </div>

               {/* FOOTER */}
               <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex gap-3 flex-shrink-0">
                    <button type="button" onClick={() => onDelete(point.id)} className="p-3 text-red-600 bg-red-100 dark:bg-red-900/30 rounded-2xl hover:bg-red-200 transition-colors"><Trash2 className="w-6 h-6"/></button>
                    {onClone && <button type="button" onClick={() => onClone(editedPoint)} className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-gray-300 transition-all flex items-center justify-center gap-2">CLONE</button>}
                    <button type="submit" className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-orange-700 transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2">SAVE CHANGES</button>
               </div>
           </form>
        )}
      </div>
    </div>
  );
};

export default TaskEditor;
