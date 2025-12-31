import React, { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { GamePoint, IconId, TaskType, PointActivationType, PointCompletionLogic, TimelineItem } from '../types';
import { detectLanguageFromText, normalizeLanguage } from '../utils/i18n';
import { ICON_COMPONENTS } from '../utils/icons';
import { getCroppedImg } from '../utils/image';
import Cropper from 'react-easy-crop';
import { generateAiImage } from '../services/ai';
import { uploadImage } from '../services/storage'; // IMPORTED
import QRCode from 'qrcode';
import { 
  X, Save, Trash2, Upload, Link, Loader2, CheckCircle, 
  AlignLeft, CheckSquare, ListChecks, ToggleLeft, SlidersHorizontal, 
  Plus, AlertCircle, ZoomIn, Scissors, Image as ImageIcon, Tag, 
  Copy, KeyRound, ChevronDown, ChevronsUpDown, RotateCw, Type, 
  Palette, Bold, Italic, Underline, MonitorPlay, Speaker, MapPin, 
  Settings, Zap, MessageSquare, Clock, Globe, Lock, Check, Wand2, Hash,
  Edit2, MousePointerClick, EyeOff, Eye, Maximize, Smartphone, Monitor, QrCode, Download, Map as MapIcon, Info,
  ListOrdered
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
const AREA_COLORS = [
    { name: 'Emerald', value: '#10b981' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Gray', value: '#64748b' },
    { name: 'Yellow', value: '#eab308' },
];
const LANGUAGES = [
  '🇬🇧 English',
  '🇩🇰 Danish (Dansk)',
  '🇩🇪 German (Deutsch)',
  '🇪🇸 Spanish (Español)',
  '🇫🇷 French (Français)',
  '🇸🇪 Swedish (Svenska)',
  '🇳🇴 Norwegian (Norsk)',
  '🇳🇱 Dutch (Nederlands)',
  '🇧🇪 Belgian (Vlaams)',
  '🇮🇱 Hebrew (Ivrit)'
];

// --- ENHANCED RICH TEXT EDITOR COMPONENT ---
const RichTextEditor = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder?: string }) => {
  const handleCommand = (command: string, val?: string) => {
    document.execCommand(command, false, val || '');
  };

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-500 transition-shadow bg-white dark:bg-gray-700">
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
        <button type="button" onClick={() => handleCommand('bold')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300" title="Bold"><Bold className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('italic')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300" title="Italic"><Italic className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleCommand('underline')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300" title="Underline"><Underline className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button type="button" onClick={() => handleCommand('insertUnorderedList')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300" title="Bullet List">●</button>
        <button type="button" onClick={() => handleCommand('insertOrderedList')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300" title="Numbered List">1.</button>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button type="button" onClick={() => handleCommand('formatBlock', 'h2')} className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 font-bold text-xs" title="Heading">H</button>
        <button type="button" onClick={() => handleCommand('formatBlock', 'p')} className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 text-xs" title="Paragraph">P</button>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button type="button" onClick={() => handleCommand('foreColor', '#ef4444')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-red-500 font-bold" title="Red Color">A</button>
        <button type="button" onClick={() => handleCommand('foreColor', '#3b82f6')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-blue-500 font-bold" title="Blue Color">A</button>
        <button type="button" onClick={() => handleCommand('foreColor', '#10b981')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-green-500 font-bold" title="Green Color">A</button>
        <button type="button" onClick={() => handleCommand('foreColor', '#f59e0b')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-amber-500 font-bold" title="Amber Color">A</button>
      </div>
      <div
        className="p-3 min-h-[120px] outline-none text-sm text-gray-900 dark:text-white prose dark:prose-invert max-w-none"
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
        style={{ whiteSpace: 'pre-wrap' }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

const TaskEditor: React.FC<TaskEditorProps> = ({ point, onSave, onDelete, onClose, onClone, isTemplateMode = false }) => {
  // Normalize the incoming language first (remove "global")
  const normalizedIncomingLanguage = normalizeLanguage(point.settings?.language);

  const [editedPoint, setEditedPoint] = useState<GamePoint>({
    ...point,
    points: point.points || 100,
    shortIntro: point.shortIntro || '',
    activationTypes: point.activationTypes || ['radius'],
    areaColor: point.areaColor || '',
    iconUrl: point.iconUrl || '',
    completionLogic: point.completionLogic || 'remove_any',
    instructorNotes: point.instructorNotes || '',
    isHiddenBeforeScan: point.isHiddenBeforeScan || false,
    isLocationLocked: point.isLocationLocked || false,
    radiusMeters: point.radiusMeters || 30, // Ensure radius default
    task: {
        type: 'text',
        options: [],
        correctAnswers: [],
        range: { min: 0, max: 100, step: 1, correctValue: 50, tolerance: 0 },
        placeholder: '',
        timelineItems: [],
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
        showAnswerStatus: true,
        showCorrectAnswerOnMiss: false,
        ...point.settings,
        language: normalizedIncomingLanguage // Ensure normalized
    },
    tags: point.tags || []
  });

  const [activeTab, setActiveTab] = useState<'GENERAL' | 'IMAGE' | 'SETTINGS' | 'ANSWER' | 'ACTIONS' | 'ACTIVATION'>('GENERAL');
  const [showTaskTypeTooltip, setShowTaskTypeTooltip] = useState(false);
  const [hoveredTaskType, setHoveredTaskType] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState(false);
  
  // Image states
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(4 / 3);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pinIconInputRef = useRef<HTMLInputElement>(null);
  const timelineImageInputRef = useRef<HTMLInputElement>(null); // For timeline item images
  const [editingTimelineItemId, setEditingTimelineItemId] = useState<string | null>(null);

  // QR Code State
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Auto-detect language from task question on component mount
  useEffect(() => {
      const hasQuestion = editedPoint.task.question && editedPoint.task.question.trim().length > 0;
      const currentLanguage = normalizeLanguage(editedPoint.settings?.language);

      // Auto-detect if: no valid language yet (default English) OR question contains special chars suggesting different language
      if (hasQuestion) {
          const detectedLanguage = detectLanguageFromText(editedPoint.task.question);

          // Update if we detected a different language than current
          if (detectedLanguage !== currentLanguage && detectedLanguage !== 'English') {
              setEditedPoint(prev => ({
                  ...prev,
                  settings: { ...prev.settings, language: detectedLanguage }
              }));
          }
      }
  }, []); // Run only on mount

  // Generate QR Code when relevant fields change or tab opens
  useEffect(() => {
      if (activeTab === 'ACTIONS' && (editedPoint.activationTypes.includes('qr') || editedPoint.activationTypes.includes('click') || editedPoint.isHiddenBeforeScan)) {
          // Payload: Use ID as unique identifier for unlocking
          const payload = JSON.stringify({ id: editedPoint.id, action: 'unlock' });
          QRCode.toDataURL(payload, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
              .then(url => setQrCodeDataUrl(url))
              .catch(err => console.error(err));
      }
  }, [activeTab, editedPoint.activationTypes, editedPoint.id, editedPoint.isHiddenBeforeScan]);

  // Generate QR Code for ACTIVATION tab when qrCodeString changes
  useEffect(() => {
      if (activeTab === 'ACTIVATION' && editedPoint.qrCodeString) {
          const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
          if (canvas) {
              QRCode.toCanvas(canvas, editedPoint.qrCodeString, { width: 150, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
                  .catch(err => console.error('QR Code generation error:', err));
          }
      }
  }, [activeTab, editedPoint.qrCodeString]);

  const handleGenerateImage = async () => {
      const prompt = editedPoint.task.question.replace(/<[^>]*>?/gm, '') + " " + editedPoint.title;
      if (!prompt.trim()) return;
      setIsGeneratingImage(true);
      const img = await generateAiImage(prompt);
      if (img) {
          // Upload AI Image to Storage for persistence
          const url = await uploadImage(img);
          setEditedPoint(prev => ({ ...prev, task: { ...prev.task, imageUrl: url || img } }));
      }
      setIsGeneratingImage(false);
  };

  const handleGenerateIcon = async () => {
      const keyword = prompt("Enter a keyword for the icon generation:", editedPoint.title || "");
      if (!keyword) return;

      setIsGeneratingImage(true);
      try {
          const prompt = `A simple, flat vector icon representing: "${keyword}". Minimalist design, solid color, white background, high contrast, suitable for a map pin.`;
          const img = await generateAiImage(prompt, 'icon');
          if (img) {
              const url = await uploadImage(img);
              setEditedPoint(prev => ({ ...prev, iconUrl: url || img }));
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingImage(false);
      }
  };

  const handlePinIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploading(true);
          const url = await uploadImage(file);
          if (url) setEditedPoint(prev => ({ ...prev, iconUrl: url }));
          setIsUploading(false);
      }
  };

  const handleAddTag = () => {
      if (tagInput.trim() && !editedPoint.tags?.includes(tagInput.trim())) {
          setEditedPoint(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
          setTagInput('');
          setTagError(false);
      }
  };

  const handleRemoveTag = (tag: string) => {
      setEditedPoint(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedPoint.tags || editedPoint.tags.length === 0) {
        setTagError(true);
        setActiveTab('GENERAL');
        return;
    }
    // Ensure language is normalized before saving
    const pointToSave = {
        ...editedPoint,
        settings: {
            ...editedPoint.settings,
            language: normalizeLanguage(editedPoint.settings?.language)
        }
    };
    onSave(pointToSave);
  };

  const handleTimelineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && editingTimelineItemId) {
          setIsUploading(true);
          const url = await uploadImage(file);
          if (url) {
              setEditedPoint(prev => ({
                  ...prev,
                  task: {
                      ...prev.task,
                      timelineItems: prev.task.timelineItems?.map(item => 
                          item.id === editingTimelineItemId ? { ...item, imageUrl: url } : item
                      )
                  }
              }));
          }
          setIsUploading(false);
          setEditingTimelineItemId(null);
      }
  };

  const renderTimelineConfig = () => {
      const items = editedPoint.task.timelineItems || [];

      const addTimelineItem = () => {
          const newItem: TimelineItem = {
              id: `ti-${Date.now()}`,
              text: '',
              description: '',
              value: 0,
              order: items.length
          };
          setEditedPoint(prev => ({
              ...prev,
              task: {
                  ...prev.task,
                  timelineItems: [...(prev.task.timelineItems || []), newItem]
              }
          }));
      };

      const updateTimelineItem = (id: string, updates: Partial<TimelineItem>) => {
          setEditedPoint(prev => ({
              ...prev,
              task: {
                  ...prev.task,
                  timelineItems: prev.task.timelineItems?.map(item => 
                      item.id === id ? { ...item, ...updates } : item
                  )
              }
          }));
      };

      const removeTimelineItem = (id: string) => {
          setEditedPoint(prev => ({
              ...prev,
              task: {
                  ...prev.task,
                  timelineItems: prev.task.timelineItems?.filter(item => item.id !== id)
              }
          }));
      };

      return (
          <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-bold mb-1">HOW IT WORKS:</p>
                  <p>Players must drag these items into a list sorted by the <strong>Sorting Value</strong> (Low to High). The "Value" is hidden until revealed. The "Description" is the text shown when revealed.</p>
              </div>

              <div className="space-y-3">
                  {items.map((item, idx) => (
                      <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex gap-4 items-start shadow-sm">
                          <div 
                              className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden relative group shrink-0"
                              onClick={() => { setEditingTimelineItemId(item.id); timelineImageInputRef.current?.click(); }}
                          >
                              {item.imageUrl ? (
                                  <img src={item.imageUrl} className="w-full h-full object-cover" />
                              ) : (
                                  <ImageIcon className="w-6 h-6 text-gray-400" />
                              )}
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Upload className="w-4 h-4 text-white" />
                              </div>
                          </div>

                          <div className="flex-1 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                  <input 
                                      type="text" 
                                      placeholder="Title (e.g. Minced Beef)" 
                                      value={item.text}
                                      onChange={(e) => updateTimelineItem(item.id, { text: e.target.value })}
                                      className="p-2 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-600 text-sm font-bold"
                                  />
                                  <input 
                                      type="number" 
                                      placeholder="Sort Value (e.g. 20)" 
                                      value={item.value}
                                      onChange={(e) => updateTimelineItem(item.id, { value: parseFloat(e.target.value) })}
                                      className="p-2 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-600 text-sm font-mono"
                                  />
                              </div>
                              <input 
                                  type="text" 
                                  placeholder="Reveal Text (e.g. Price rose by 20%...)" 
                                  value={item.description}
                                  onChange={(e) => updateTimelineItem(item.id, { description: e.target.value })}
                                  className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-600 text-xs"
                              />
                          </div>

                          <button onClick={() => removeTimelineItem(item.id)} className="text-red-400 hover:text-red-500 p-1">
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>

              <button 
                  type="button" 
                  onClick={addTimelineItem}
                  className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2 text-sm font-bold uppercase"
              >
                  <Plus className="w-4 h-4" /> ADD CHOICE
              </button>
              
              <input ref={timelineImageInputRef} type="file" className="hidden" accept="image/*" onChange={handleTimelineImageUpload} />
          </div>
      );
  };

  const renderTypeConfig = () => {
    // ... (unchanged logic for renderTypeConfig)
    const { type, options, answer } = editedPoint.task;
    const correctAnswers = editedPoint.task.correctAnswers || [];
    
    const addOption = () => setEditedPoint(prev => ({...prev, task: {...prev.task, options: [...(prev.task.options||[]), `Option ${(prev.task.options?.length||0)+1}`]}}));
    
    const updateOption = (i: number, val: string) => {
        const newOpts = [...(options||[])]; 
        const oldVal = newOpts[i];
        newOpts[i] = val;
        let newCorrectAnswers = correctAnswers;
        if (correctAnswers.includes(oldVal)) {
            newCorrectAnswers = correctAnswers.map(c => c === oldVal ? val : c);
        }
        let newAnswer = answer;
        if (answer === oldVal) {
            newAnswer = val;
        }
        setEditedPoint({...editedPoint, task: {...editedPoint.task, options: newOpts, correctAnswers: newCorrectAnswers, answer: newAnswer }});
    };

    const removeOption = (i: number) => {
        const optToRemove = options?.[i];
        const newOpts = [...(options||[])]; newOpts.splice(i, 1);
        let newCorrectAnswers = correctAnswers;
        if (optToRemove && correctAnswers.includes(optToRemove)) {
            newCorrectAnswers = correctAnswers.filter(c => c !== optToRemove);
        }
        let newAnswer = answer;
        if (answer === optToRemove) newAnswer = undefined;
        setEditedPoint({...editedPoint, task: {...editedPoint.task, options: newOpts, correctAnswers: newCorrectAnswers, answer: newAnswer }});
    };

    const toggleCorrectOption = (opt: string) => {
        const isMulti = type === 'checkbox' || type === 'multi_select_dropdown';
        if (isMulti) {
            const current = correctAnswers;
            const newAnswers = current.includes(opt) 
                ? current.filter(a => a !== opt)
                : [...current, opt];
            setEditedPoint({...editedPoint, task: { ...editedPoint.task, correctAnswers: newAnswers }});
        } else {
            setEditedPoint({...editedPoint, task: { ...editedPoint.task, answer: opt }});
        }
    };

    if (type === 'timeline') {
        return renderTimelineConfig();
    }

    if (type === 'text') {
        return (
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CORRECT ANSWER</label>
                <input type="text" value={editedPoint.task.answer || ''} onChange={(e) => setEditedPoint({...editedPoint, task: {...editedPoint.task, answer: e.target.value}})} className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-sm"/>
            </div>
        );
    }
    
    if (['multiple_choice', 'checkbox', 'dropdown', 'multi_select_dropdown'].includes(type)) {
        const isMulti = type === 'checkbox' || type === 'multi_select_dropdown';
        return (
            <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">OPTIONS & ANSWERS</label>
                {options?.map((opt, idx) => {
                    const isCorrect = isMulti ? correctAnswers.includes(opt) : answer === opt;
                    return (
                        <div key={idx} className="flex gap-2 items-center group">
                            <button type="button" onClick={() => toggleCorrectOption(opt)} className={`p-2 rounded border transition-colors ${isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 hover:border-green-400 hover:text-green-400'}`} title={isCorrect ? "Correct Answer" : "Mark as Correct"}><Check className="w-4 h-4" /></button>
                            <input type="text" value={opt} onChange={(e) => updateOption(idx, e.target.value)} className={`flex-1 p-2 border rounded bg-white dark:bg-gray-700 text-sm ${isCorrect ? 'border-green-500 ring-1 ring-green-500/20' : ''}`}/>
                            <button type="button" onClick={() => removeOption(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded opacity-50 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    );
                })}
                <button type="button" onClick={addOption} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline mt-2"><Plus className="w-3 h-3" /> ADD OPTION</button>
            </div>
        );
    }
    return <p className="text-xs text-gray-500 uppercase italic">No specific settings needed for this type.</p>;
  };

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
                  <Cropper 
                    image={pendingImage} 
                    crop={crop} 
                    zoom={zoom} 
                    rotation={rotation} 
                    aspect={aspect} 
                    onCropChange={setCrop} 
                    onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)} 
                    onZoomChange={setZoom} 
                    onRotationChange={setRotation} 
                    onMediaLoaded={(mediaSize) => {
                        setZoom(1);
                    }}
                  />
              </div>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  <button type="button" onClick={() => setRotation((r) => r + 90)} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"><RotateCw className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-3">
                  <button type="button" onClick={() => { setIsCropping(false); setPendingImage(null); }} className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-bold uppercase tracking-wide">CANCEL</button>
                  <button type="button" onClick={async () => {
                      setIsUploading(true);
                      try {
                          if (!pendingImage) throw new Error("No image to crop");
                          const imgBase64 = await getCroppedImg(pendingImage, croppedAreaPixels, rotation);
                          // Upload the cropped result to storage
                          const url = await uploadImage(imgBase64);
                          setEditedPoint({...editedPoint, task: {...editedPoint.task, imageUrl: url || imgBase64}});
                          setIsCropping(false); 
                          setPendingImage(null);
                      } catch(e: any) { 
                          console.error(e);
                      }
                      setIsUploading(false);
                  }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-wide">{isUploading ? 'UPLOADING...' : 'CROP & SAVE'}</button>
              </div>
           </div>
        ) : (
           <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
               {/* ... Tab Navigation (Same as before) ... */}
               <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0 overflow-x-auto">
                   {[
                       {id: 'GENERAL', label: 'General', icon: AlignLeft},
                       {id: 'IMAGE', label: 'Image', icon: ImageIcon},
                       {id: 'SETTINGS', label: 'Config', icon: SlidersHorizontal},
                       {id: 'ANSWER', label: 'Answer', icon: MessageSquare},
                       {id: 'ACTIVATION', label: 'Activation', icon: Lock},
                       {id: 'ACTIONS', label: 'Actions', icon: Zap},
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
               <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-gray-900 custom-scrollbar">
                   
                   {activeTab === 'GENERAL' && (
                       <div className="space-y-6">
                           <div>
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">Title</label>
                               <input type="text" value={editedPoint.title} onChange={(e) => setEditedPoint({ ...editedPoint, title: e.target.value })} className="w-full px-4 py-2 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-orange-500 outline-none transition-all" placeholder="e.g. Statue Quiz"/>
                           </div>
                           
                           {/* TAGS SECTION */}
                          <div>
                              <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2 ${tagError ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                  TAGS
                                  {(!editedPoint.tags || editedPoint.tags.length === 0) && (
                                      <span className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-[8px] px-1 rounded">REQUIRED</span>
                                  )}
                                  {tagError && <AlertCircle className="w-3 h-3 text-red-500" />}
                              </label>
                               <div className="flex flex-wrap gap-2 mb-2">
                                   {editedPoint.tags?.map((tag, index) => (
                                       <span key={`${tag}-${index}`} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                           {tag}
                                           <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-blue-900 dark:hover:text-white"><X className="w-3 h-3" /></button>
                                       </span>
                                   ))}
                               </div>
                               <div className="flex gap-2">
                                   <input 
                                      type="text" 
                                      value={tagInput} 
                                      onChange={(e) => setTagInput(e.target.value)} 
                                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                      className={`flex-1 px-3 py-2 border-2 ${tagError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'dark:border-gray-700 bg-gray-50 dark:bg-gray-800'} rounded-lg text-sm outline-none`} 
                                      placeholder="Add tag and press Enter..." 
                                   />
                                   <button type="button" onClick={handleAddTag} className="px-3 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"><Plus className="w-4 h-4" /></button>
                               </div>
                               {tagError && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase">At least one tag is required to save.</p>}
                           </div>

                           <div>
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">TASK DESCRIPTION</label>
                               <RichTextEditor value={editedPoint.task.question} onChange={(html) => setEditedPoint({ ...editedPoint, task: { ...editedPoint.task, question: html } })} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em] flex items-center gap-1">
                                      TYPE <Info className="w-3 h-3 text-blue-500" title="Hover over type for info" />
                                  </label>
                                  <div className="relative group">
                                      <select
                                          value={editedPoint.task.type}
                                          onChange={(e) => setEditedPoint({ ...editedPoint, task: { ...editedPoint.task, type: e.target.value as any } })}
                                          onMouseEnter={() => setShowTaskTypeTooltip(true)}
                                          onMouseLeave={() => setShowTaskTypeTooltip(false)}
                                          className="w-full px-4 py-2.5 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-orange-500 outline-none appearance-none cursor-pointer text-sm"
                                      >
                                          <option value="text">TEXT INPUT</option>
                                          <option value="multiple_choice">QUIZ (MC)</option>
                                          <option value="boolean">YES / NO</option>
                                          <option value="slider">SLIDER</option>
                                          <option value="checkbox">CHECKBOXES</option>
                                          <option value="dropdown">DROPDOWN</option>
                                          <option value="timeline">TIMELINE / ORDER</option>
                                      </select>
                                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                      {showTaskTypeTooltip && (
                                          <div className="absolute left-0 top-full mt-2 w-72 bg-blue-900 border-2 border-blue-500 rounded-xl p-3 shadow-2xl z-50 text-xs text-blue-100 space-y-2">
                                              {editedPoint.task.type === 'text' && (
                                                  <><p className="font-bold text-blue-200">📝 TEXT INPUT</p><p className="text-blue-300/80">Players type their answer</p><p className="italic text-blue-400">Ex: "Capital of Denmark?"</p></>
                                              )}
                                              {editedPoint.task.type === 'multiple_choice' && (
                                                  <><p className="font-bold text-blue-200">✅ QUIZ (MC)</p><p className="text-blue-300/80">Select from options</p><p className="italic text-blue-400">Ex: A) Paris B) Copenhagen</p></>
                                              )}
                                              {editedPoint.task.type === 'boolean' && (
                                                  <><p className="font-bold text-blue-200">✔️ YES / NO</p><p className="text-blue-300/80">True or false question</p><p className="italic text-blue-400">Ex: "Is this correct?"</p></>
                                              )}
                                              {editedPoint.task.type === 'slider' && (
                                                  <><p className="font-bold text-blue-200">🎚️ SLIDER</p><p className="text-blue-300/80">Select number on scale</p><p className="italic text-blue-400">Ex: "How tall? (1-100m)"</p></>
                                              )}
                                              {editedPoint.task.type === 'checkbox' && (
                                                  <><p className="font-bold text-blue-200">☑️ CHECKBOXES</p><p className="text-blue-300/80">Multiple correct answers</p><p className="italic text-blue-400">Ex: "Nordic countries?"</p></>
                                              )}
                                              {editedPoint.task.type === 'dropdown' && (
                                                  <><p className="font-bold text-blue-200">📋 DROPDOWN</p><p className="text-blue-300/80">Pick from menu</p><p className="italic text-blue-400">Ex: "Select the year"</p></>
                                              )}
                                              {editedPoint.task.type === 'timeline' && (
                                                  <><p className="font-bold text-blue-200">📅 TIMELINE</p><p className="text-blue-300/80">Arrange in order</p><p className="italic text-blue-400">Ex: "Sort by date"</p></>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              </div>
                               <div>
                                   <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">POINTS</label>
                                   <input type="number" value={editedPoint.points} onChange={(e) => setEditedPoint({ ...editedPoint, points: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-orange-500 outline-none transition-all text-sm"/>
                               </div>
                           </div>
                           <div className="p-4 bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                               {renderTypeConfig()}
                           </div>
                       </div>
                   )}

                   {activeTab === 'IMAGE' && (
                       <div className="space-y-6">
                           <div>
                               <div className="flex justify-between items-center mb-3">
                                   <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">COVER IMAGE</label>
                                   <div className="flex gap-2">
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-orange-500 hover:text-white transition-all uppercase tracking-wide flex items-center gap-1"><Upload className="w-3 h-3" /> UPLOAD</button>
                                        <button type="button" onClick={handleGenerateImage} disabled={isGeneratingImage} className="text-[10px] font-black px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all uppercase tracking-wide flex items-center gap-1 shadow-md disabled:opacity-50">{isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI GEN</button>
                                   </div>
                               </div>
                               <div className="w-full rounded-2xl border-4 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 flex items-center justify-center relative overflow-hidden group min-h-[200px]">
                                   {isUploading ? (
                                       <div className="flex flex-col items-center">
                                           <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                           <p className="text-[10px] font-bold text-gray-500 mt-2">UPLOADING...</p>
                                       </div>
                                   ) : editedPoint.task.imageUrl ? (
                                       <>
                                           <img src={editedPoint.task.imageUrl} className="max-w-full max-h-[400px] object-contain" alt="Task Cover" />
                                           <div className="absolute top-4 right-4 flex gap-2">
                                              <button type="button" onClick={() => { setPendingImage(editedPoint.task.imageUrl || null); setIsCropping(true); }} className="p-2 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Scissors className="w-4 h-4"/></button>
                                              <button type="button" onClick={() => setEditedPoint({...editedPoint, task: {...editedPoint.task, imageUrl: undefined}})} className="p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 className="w-4 h-4"/></button>
                                           </div>
                                       </>
                                   ) : (
                                       <div className="text-center opacity-30 group-hover:opacity-50 transition-opacity p-8">
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
                       </div>
                   )}

                   {/* ... Settings and Actions Tabs ... */}
                   {activeTab === 'SETTINGS' && (
                       <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                           {/* ... Radius and Area Color ... */}
                           <div>
                               <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 block flex justify-between">
                                   <span>TRIGGER RADIUS</span>
                                   <span className="text-white font-bold">{editedPoint.radiusMeters}m</span>
                               </label>
                               <div className="flex items-center gap-4">
                                   <MapPin className="w-5 h-5 text-slate-500" />
                                   <input 
                                       type="range" 
                                       min="5" 
                                       max="200" 
                                       step="5" 
                                       value={editedPoint.radiusMeters} 
                                       onChange={(e) => setEditedPoint({...editedPoint, radiusMeters: parseInt(e.target.value)})}
                                       className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                   />
                               </div>
                           </div>

                           {/* MAP ICON */}
                           <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                               <div className="flex justify-between items-center mb-3">
                                   <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">MAP PIN ICON</label>
                                   <div className="flex gap-2">
                                       <button 
                                           type="button" 
                                           onClick={handleGenerateIcon}
                                           disabled={isGeneratingImage}
                                           className="text-[9px] font-black bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                       >
                                           {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3" />} AI GEN
                                       </button>
                                       <button 
                                           type="button" 
                                           onClick={() => pinIconInputRef.current?.click()}
                                           className="text-[9px] font-black bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                       >
                                           <Upload className="w-3 h-3" /> UPLOAD
                                       </button>
                                   </div>
                                   <input ref={pinIconInputRef} type="file" accept="image/*" className="hidden" onChange={handlePinIconUpload} />
                               </div>
                               
                               <div className="grid grid-cols-6 gap-2">
                                   {Object.keys(ICON_COMPONENTS).map(iconKey => {
                                       const Icon = ICON_COMPONENTS[iconKey as IconId];
                                       const isActive = editedPoint.iconId === iconKey && !editedPoint.iconUrl;
                                       return (
                                           <button
                                               key={iconKey}
                                               type="button"
                                               onClick={() => setEditedPoint({...editedPoint, iconId: iconKey as IconId, iconUrl: undefined})}
                                               className={`aspect-square rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-orange-600 text-white shadow-lg scale-105' : 'bg-white dark:bg-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                           >
                                               <Icon className="w-5 h-5" />
                                           </button>
                                       )
                                   })}
                               </div>
                               
                               {editedPoint.iconUrl && (
                                   <div className="mt-4 flex items-center gap-3 p-3 bg-slate-200 dark:bg-slate-900 rounded-xl border border-orange-500/50">
                                       <img src={editedPoint.iconUrl} className="w-10 h-10 rounded-full object-cover border-2 border-orange-500" />
                                       <span className="text-xs font-bold text-orange-600 dark:text-orange-400 flex-1">CUSTOM ICON ACTIVE</span>
                                       <button type="button" onClick={() => setEditedPoint({...editedPoint, iconUrl: undefined})} className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-lg hover:bg-red-200"><Trash2 className="w-4 h-4" /></button>
                                   </div>
                               )}
                           </div>
                           
                           {/* ... Area Color ... */}
                           <div>
                               <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-3 block uppercase tracking-widest">AREA COLOR (GEOFENCE)</label>
                               <div className="flex flex-wrap gap-3">
                                   <button 
                                       type="button"
                                       onClick={() => setEditedPoint({...editedPoint, areaColor: undefined})}
                                       className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${!editedPoint.areaColor ? 'border-white scale-110 shadow' : 'border-slate-600 opacity-50'}`}
                                       title="Default"
                                   >
                                       <div className="w-full h-0.5 bg-slate-500 rotate-45" />
                                   </button>
                                   {AREA_COLORS.map(c => (
                                       <button
                                           key={c.value}
                                           type="button"
                                           onClick={() => setEditedPoint({...editedPoint, areaColor: c.value})}
                                           className={`w-8 h-8 rounded-full border-2 transition-all ${editedPoint.areaColor === c.value ? 'border-white scale-110 shadow' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                           style={{ backgroundColor: c.value }}
                                           title={c.name}
                                       />
                                   ))}
                               </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em] flex items-center gap-1">
                                      Time limit <Info className="w-3 h-3" />
                                  </label>
                                  <div className="flex">
                                      <input 
                                           type="number" 
                                           value={editedPoint.settings?.timeLimitSeconds || ''}
                                           onChange={(e) => setEditedPoint({...editedPoint, settings: {...editedPoint.settings, timeLimitSeconds: parseInt(e.target.value) || undefined }})}
                                           className="w-full px-4 py-3 border-2 border-r-0 dark:border-gray-700 rounded-l-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium outline-none focus:border-orange-500 transition-all text-sm"
                                           placeholder="∞"
                                      />
                                      <span className="bg-gray-100 dark:bg-gray-700 border-2 dark:border-gray-700 border-l-0 rounded-r-xl px-3 flex items-center text-[10px] font-bold text-gray-500 uppercase">SEC</span>
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em]">LANGUAGE</label>
                                  <div className="flex gap-2">
                                      <select
                                       value={normalizeLanguage(editedPoint.settings?.language)}
                                       onChange={(e) => setEditedPoint({...editedPoint, settings: {...editedPoint.settings, language: e.target.value }})}
                                       className="flex-1 px-4 py-3 border-2 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium outline-none focus:border-orange-500 uppercase text-xs"
                                  >
                                      {['English', 'Danish', 'German', 'Spanish', 'French', 'Swedish', 'Norwegian', 'Dutch', 'Belgian', 'Hebrew'].map(lang => (
                                          <option key={lang} value={lang}>{lang}</option>
                                      ))}
                                      </select>
                                      <button
                                          type="button"
                                          onClick={() => {
                                              if (editedPoint.task.question) {
                                                  const detected = detectLanguageFromText(editedPoint.task.question);
                                                  setEditedPoint({
                                                      ...editedPoint,
                                                      settings: { ...editedPoint.settings, language: detected }
                                                  });
                                              }
                                          }}
                                          className="px-4 py-3 border-2 dark:border-gray-700 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-bold uppercase text-[10px] transition-colors"
                                          title="Auto-detect language from question"
                                      >
                                          🔍 AUTO
                                      </button>
                                  </div>
                              </div>
                           </div>
                       </div>
                   )}

                   {activeTab === 'ANSWER' && (
                       <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                           {/* HINT SECTION */}
                           <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-5 rounded-2xl border-2 border-yellow-200 dark:border-yellow-700">
                               <div className="flex items-center gap-2 mb-3">
                                   <MessageSquare className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                   <label className="text-[10px] font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-[0.2em]">HINT System</label>
                               </div>

                               <div className="space-y-4">
                                   <div>
                                       <label className="block text-[9px] font-bold text-yellow-700/80 dark:text-yellow-400/80 mb-1.5 uppercase">Hint Text</label>
                                       <textarea
                                           value={editedPoint.feedback?.hint || ''}
                                           onChange={(e) => setEditedPoint({
                                               ...editedPoint,
                                               feedback: {...editedPoint.feedback, hint: e.target.value}
                                           })}
                                           placeholder="Enter a helpful hint for players..."
                                           className="w-full px-4 py-3 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:border-yellow-500 resize-none"
                                           rows={3}
                                       />
                                       <p className="text-[9px] text-yellow-600 dark:text-yellow-400 mt-1 italic">Leave empty to hide hint button from players</p>
                                   </div>

                                   <div>
                                       <label className="block text-[9px] font-bold text-yellow-700/80 dark:text-yellow-400/80 mb-1.5 uppercase">Points Deduction for Using Hint</label>
                                       <div className="flex items-center gap-3">
                                           <input
                                               type="number"
                                               value={editedPoint.feedback?.hintCost || 0}
                                               onChange={(e) => setEditedPoint({
                                                   ...editedPoint,
                                                   feedback: {...editedPoint.feedback, hintCost: parseInt(e.target.value) || 0}
                                               })}
                                               className="w-32 px-4 py-2 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold outline-none focus:border-yellow-500"
                                           />
                                           <span className="text-sm text-yellow-700 dark:text-yellow-300 font-bold">points</span>
                                       </div>
                                       <p className="text-[9px] text-yellow-600 dark:text-yellow-400 mt-1">Default: -50 points (use negative for deduction)</p>
                                   </div>
                               </div>
                           </div>

                           {/* FEEDBACK MESSAGES */}
                           <div className="grid grid-cols-1 gap-4">
                               <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-700">
                                   <label className="block text-[9px] font-bold text-green-700 dark:text-green-300 mb-2 uppercase flex items-center gap-1">
                                       <CheckCircle className="w-3 h-3" /> Correct Answer Message
                                   </label>
                                   <textarea
                                       value={editedPoint.feedback?.correctMessage || ''}
                                       onChange={(e) => setEditedPoint({
                                           ...editedPoint,
                                           feedback: {...editedPoint.feedback, correctMessage: e.target.value}
                                       })}
                                       className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg bg-white dark:bg-gray-800 text-sm outline-none"
                                       rows={2}
                                   />
                               </div>

                               <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border-2 border-red-200 dark:border-red-700">
                                   <label className="block text-[9px] font-bold text-red-700 dark:text-red-300 mb-2 uppercase flex items-center gap-1">
                                       <AlertCircle className="w-3 h-3" /> Incorrect Answer Message
                                   </label>
                                   <textarea
                                       value={editedPoint.feedback?.incorrectMessage || ''}
                                       onChange={(e) => setEditedPoint({
                                           ...editedPoint,
                                           feedback: {...editedPoint.feedback, incorrectMessage: e.target.value}
                                       })}
                                       className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-800 text-sm outline-none"
                                       rows={2}
                                   />
                               </div>
                           </div>
                       </div>
                   )}

                   {activeTab === 'ACTIVATION' && (
                       <div className="space-y-6">
                           {/* Location Lock Feature */}
                           <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
                               <div className="flex items-start gap-4">
                                   <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                       <Lock className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                       <h3 className="font-black text-sm uppercase tracking-wide mb-1">Location-Specific Task</h3>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Lock this task to its current location. Players can only complete it at this specific point on the map.</p>

                                       {editedPoint.location ? (
                                           <div className="space-y-3">
                                               <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                                                   <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">📍 CURRENT LOCATION</p>
                                                   <p className="text-sm font-mono text-gray-900 dark:text-white">{editedPoint.location.lat.toFixed(6)}, {editedPoint.location.lng.toFixed(6)}</p>
                                                   <p className="text-[10px] text-gray-500 mt-1">Radius: {editedPoint.radiusMeters}m</p>
                                               </div>

                                               <button
                                                   type="button"
                                                   onClick={() => setEditedPoint({...editedPoint, isLocationLocked: !editedPoint.isLocationLocked})}
                                                   className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${editedPoint.isLocationLocked ? 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-500/30' : 'bg-white dark:bg-gray-800 text-blue-600 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-gray-700'}`}
                                               >
                                                   {editedPoint.isLocationLocked ? (
                                                       <>
                                                           <Lock className="w-5 h-5" />
                                                           LOCKED TO LOCATION ✓
                                                       </>
                                                   ) : (
                                                       <>
                                                           <Lock className="w-5 h-5 opacity-40" />
                                                           UNLOCK FROM LOCATION
                                                       </>
                                                   )}
                                               </button>

                                               {editedPoint.isLocationLocked && (
                                                   <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-3">
                                                       <p className="text-xs text-blue-900 dark:text-blue-200 font-bold">
                                                           ✓ This task is now locked to this location. Players must be within {editedPoint.radiusMeters}m to solve it.
                                                       </p>
                                                   </div>
                                               )}
                                           </div>
                                       ) : (
                                           <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
                                               <p className="text-xs text-yellow-900 dark:text-yellow-200 font-bold">
                                                   ⚠️ This task doesn't have a location set yet. Set a location on the map first to enable location locking.
                                               </p>
                                           </div>
                                       )}
                                   </div>
                               </div>
                           </div>

                           {/* QR Code Configuration */}
                           <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-2xl border-2 border-purple-200 dark:border-purple-800">
                               <div className="flex items-start gap-4">
                                   <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                       <QrCode className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                       <h3 className="font-black text-sm uppercase tracking-wide mb-1">QR Code Activation</h3>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Attach a QR code string to this task (e.g., house ID, location code). Players must scan this code to unlock the task.</p>

                                       <div className="space-y-3">
                                           <div>
                                               <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">📱 QR CODE STRING</label>
                                               <input
                                                   type="text"
                                                   value={editedPoint.qrCodeString || ''}
                                                   onChange={(e) => setEditedPoint({...editedPoint, qrCodeString: e.target.value})}
                                                   placeholder="e.g., HOUSE_001, LOCATION_ALPHA, or any unique identifier"
                                                   className="w-full px-4 py-3 border-2 border-purple-200 dark:border-purple-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:border-purple-500 outline-none transition-all"
                                               />
                                               <p className="text-[10px] text-gray-500 mt-2">This is the value that will be encoded in the QR code.</p>
                                           </div>

                                           {editedPoint.qrCodeString && (
                                               <div className="space-y-3">
                                                   <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-purple-200 dark:border-purple-700 flex flex-col items-center">
                                                       <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 text-center">📤 DOWNLOADABLE QR CODE</p>
                                                       <div id="qr-preview" className="flex items-center justify-center bg-white p-2 rounded-lg border border-purple-100 dark:border-purple-900">
                                                           <canvas id="qr-canvas" style={{ maxWidth: '150px', maxHeight: '150px' }} />
                                                       </div>
                                                       <button
                                                           type="button"
                                                           onClick={async () => {
                                                               const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
                                                               if (canvas) {
                                                                   const url = canvas.toDataURL('image/png');
                                                                   const link = document.createElement('a');
                                                                   link.href = url;
                                                                   link.download = `qr-code-${editedPoint.qrCodeString || 'task'}.png`;
                                                                   link.click();
                                                               }
                                                           }}
                                                           className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-2 transition-colors"
                                                       >
                                                           <Download className="w-4 h-4" /> Download QR
                                                       </button>
                                                   </div>
                                               </div>
                                           )}

                                           {!editedPoint.qrCodeString && (
                                               <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-300 dark:border-gray-700 text-center">
                                                   <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Enter a QR code string above to generate a downloadable QR code.</p>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               </div>
                           </div>
                       </div>
                   )}

                   {activeTab === 'ACTIONS' && (
                       <div className="space-y-6">
                           <div className="space-y-3">
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">UNLOCK METHODS</label>
                               {[
                                   { id: 'radius', label: 'GPS GEOFENCE', desc: 'Unlocks within physical radius', icon: MapIcon },
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
                       </div>
                   )}
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
