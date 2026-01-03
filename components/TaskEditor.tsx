import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { GamePoint, IconId, TaskType, PointActivationType, PointCompletionLogic, TimelineItem, TaskColorScheme } from '../types';
import { detectLanguageFromText, normalizeLanguage, getFlag } from '../utils/i18n';
import { ICON_COMPONENTS } from '../utils/icons';
import { getCroppedImg } from '../utils/image';
import Cropper from 'react-easy-crop';
import { generateAiImage, translateTaskContent } from '../services/ai';
import { uploadImage } from '../services/storage'; // IMPORTED
import { fetchUniqueTags } from '../services/db';
import { useTagColors } from '../contexts/TagColorsContext';
import QRCode from 'qrcode';
import MeetingPointMapPicker from './MeetingPointMapPicker';
import ColorSchemeEditor from './ColorSchemeEditor';
import {
  X, Save, Trash2, Upload, Link, Loader2, CheckCircle,
  AlignLeft, CheckSquare, ListChecks, ToggleLeft, SlidersHorizontal,
  Plus, AlertCircle, AlertTriangle, ZoomIn, Scissors, Image as ImageIcon, Tag,
  Copy, KeyRound, ChevronDown, ChevronsUpDown, RotateCw, Type,
  Palette, Bold, Italic, Underline, MonitorPlay, Speaker, MapPin,
  Settings, Zap, MessageSquare, Clock, Globe, Lock, Check, Wand2, Hash,
  Edit2, MousePointerClick, EyeOff, Eye, Maximize, Smartphone, Monitor, QrCode, Download, Map as MapIcon, Info,
  ListOrdered, Wifi, Users
} from 'lucide-react';
import DevicePreviewModal from './DevicePreviewModal';

interface TaskEditorProps {
  point: GamePoint;
  onSave: (point: GamePoint) => void;
  onDelete: (pointId: string) => void;
  onClose: () => void;
  onClone?: (point: GamePoint) => void;
  isTemplateMode?: boolean;
  requestedTab?: 'GENERAL' | 'IMAGE' | 'SETTINGS' | 'ANSWER' | 'ACTIVATION' | 'TAGS' | 'LANGUAGES' | 'MEDIA' | 'VIEW' | null;
  gameMode?: 'standard' | 'playzone';
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

const TaskEditor: React.FC<TaskEditorProps> = ({ point, onSave, onDelete, onClose, onClone, isTemplateMode = false, requestedTab = null, gameMode = undefined }) => {
  // Normalize the incoming language first (remove "global")
  const normalizedIncomingLanguage = normalizeLanguage(point.settings?.language);

  const [editedPoint, setEditedPoint] = useState<GamePoint>({
    ...point,
    points: point.points || 100,
    shortIntro: point.shortIntro || '',
    activationTypes: point.activationTypes && point.activationTypes.length > 0 ? point.activationTypes : ['radius'], // GPS (radius) enabled by default
    areaColor: point.areaColor || '',
    iconUrl: point.iconUrl || '',
    completionLogic: point.completionLogic || 'remove_any',
    instructorNotes: point.instructorNotes || '',
    isHiddenBeforeScan: point.isHiddenBeforeScan || false,
    isLocationLocked: point.isLocationLocked || false,
    radiusMeters: point.radiusMeters || 30, // Ensure radius default
    proximityTriggerEnabled: point.proximityTriggerEnabled || false,
    proximityRevealRadius: point.proximityRevealRadius || 100,
    proximityStaysVisible: point.proximityStaysVisible !== false, // Default true
    timeBombEnabled: point.timeBombEnabled || false,
    timeBombDuration: point.timeBombDuration || 300, // Default 5 minutes
    timeBombStartTrigger: point.timeBombStartTrigger || 'onUnlock',
    timeBombPenalty: point.timeBombPenalty || -100,
    timeBombAutoFail: point.timeBombAutoFail || false,
    multiTeamEnabled: point.multiTeamEnabled || false,
    multiTeamRequiredCount: point.multiTeamRequiredCount || 2,
    multiTeamRadius: point.multiTeamRadius || 50,
    multiTeamCompletionMode: point.multiTeamCompletionMode || 'all',
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
        incorrectMessage: 'Sorry! Not quite right...',
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
        maxAttempts: 1,
        matchTolerance: 80,
        ...point.settings,
        language: normalizedIncomingLanguage // Ensure normalized
    },
    tags: point.tags || []
  });

  const [activeTab, setActiveTab] = useState<'GENERAL' | 'IMAGE' | 'SETTINGS' | 'ANSWER' | 'ACTIVATION' | 'TAGS' | 'LANGUAGES' | 'MEDIA' | 'VIEW'>(requestedTab || 'GENERAL');
  const [showTaskTypeTooltip, setShowTaskTypeTooltip] = useState(false);
  const [hoveredTaskType, setHoveredTaskType] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState(false);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const { tagColors } = useTagColors();
  const [qrCodeDuplicateWarning, setQrCodeDuplicateWarning] = useState(false);

  // Map picker modal state
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Color scheme editor state
  const [showColorSchemeEditor, setShowColorSchemeEditor] = useState(false);

  // Device preview modal state
  const [showDevicePreview, setShowDevicePreview] = useState(false);

  // Collapse/expand states for activation sections
  const [expandedActivations, setExpandedActivations] = useState<Record<string, boolean>>({
    click: false,
    location: false,
    proximity: false,
    qr: false,
    nfc: false,
    ibeacon: false
  });
  
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

  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedTranslationLanguage, setSelectedTranslationLanguage] = useState<string>('');
  const [expandedLanguages, setExpandedLanguages] = useState<Set<string>>(new Set());

  // Load existing tags for autocomplete
  useEffect(() => {
      fetchUniqueTags().then(tags => setExistingTags(tags)).catch(() => setExistingTags([]));
  }, []);

  // Track original task content to detect changes
  const [originalTaskContent, setOriginalTaskContent] = useState(() => ({
    question: point.task.question,
    options: JSON.stringify(point.task.options || []),
    answer: point.task.answer,
    correctAnswers: JSON.stringify(point.task.correctAnswers || []),
    correctMessage: point.feedback?.correctMessage || '',
    incorrectMessage: point.feedback?.incorrectMessage || '',
    hint: point.feedback?.hint || '',
  }));

  // Invalidate all translation approvals when base task content changes
  useEffect(() => {
    const currentContent = {
      question: editedPoint.task.question,
      options: JSON.stringify(editedPoint.task.options || []),
      answer: editedPoint.task.answer,
      correctAnswers: JSON.stringify(editedPoint.task.correctAnswers || []),
      correctMessage: editedPoint.feedback?.correctMessage || '',
      incorrectMessage: editedPoint.feedback?.incorrectMessage || '',
      hint: editedPoint.feedback?.hint || '',
    };

    // Check if any content has changed
    const hasChanged =
      currentContent.question !== originalTaskContent.question ||
      currentContent.options !== originalTaskContent.options ||
      currentContent.answer !== originalTaskContent.answer ||
      currentContent.correctAnswers !== originalTaskContent.correctAnswers ||
      currentContent.correctMessage !== originalTaskContent.correctMessage ||
      currentContent.incorrectMessage !== originalTaskContent.incorrectMessage ||
      currentContent.hint !== originalTaskContent.hint;

    if (hasChanged && editedPoint.task.translations && Object.keys(editedPoint.task.translations).length > 0) {
      // Invalidate all translation approvals
      const updatedTranslations: any = {};

      Object.keys(editedPoint.task.translations).forEach(lang => {
        const translation = editedPoint.task.translations![lang as any];
        updatedTranslations[lang] = {
          ...translation,
          questionApproved: false,
          optionsApproved: translation.options ? false : translation.optionsApproved,
          answerApproved: translation.answer ? false : translation.answerApproved,
          correctAnswersApproved: translation.correctAnswers ? false : translation.correctAnswersApproved,
          feedback: translation.feedback ? {
            ...translation.feedback,
            correctMessageApproved: false,
            incorrectMessageApproved: false,
            hintApproved: translation.feedback.hint ? false : translation.feedback.hintApproved,
          } : translation.feedback,
        };
      });

      setEditedPoint(prev => ({
        ...prev,
        task: {
          ...prev.task,
          translations: updatedTranslations,
        },
      }));

      // Update the original content reference
      setOriginalTaskContent(currentContent);
    }
  }, [
    editedPoint.task.question,
    editedPoint.task.options,
    editedPoint.task.answer,
    editedPoint.task.correctAnswers,
    editedPoint.feedback?.correctMessage,
    editedPoint.feedback?.incorrectMessage,
    editedPoint.feedback?.hint,
  ]);

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
      try {
          console.log('[TaskEditor] Generating AI illustration for:', prompt);
          const img = await generateAiImage(prompt);

          if (img) {
              console.log('[TaskEditor] Illustration generated successfully');
              // Upload AI Image to Storage for persistence
              const url = await uploadImage(img);
              setEditedPoint(prev => ({ ...prev, task: { ...prev.task, imageUrl: url || img } }));
          } else {
              console.warn('[TaskEditor] AI returned null');
              alert('⚠️ Image generation failed\n\nPlease check your Gemini API key in the settings or try again with a different prompt.');
          }
      } catch (error: any) {
          console.error('[TaskEditor] Error generating image:', error);
          const errorMessage = error?.message || '';
          if (errorMessage.includes('AI API Key missing')) {
              alert('Gemini API Key is missing. Please set your API key in Local Storage or contact an administrator.\n\nGet a free API key at https://aistudio.google.com/app/apikey');
          } else {
              alert('Error generating image. Please try again.\n\n' + errorMessage);
          }
      } finally {
          setIsGeneratingImage(false);
      }
  };

  const handleGenerateIcon = async () => {
      const keyword = prompt("Enter a keyword for the icon generation:", editedPoint.title || "");
      if (!keyword) return;

      setIsGeneratingImage(true);
      try {
          const promptText = `A simple, flat vector icon representing: "${keyword}". Minimalist design, solid color, white background, high contrast, suitable for a map pin.`;
          console.log('[TaskEditor] Generating AI icon for:', keyword);

          const img = await generateAiImage(promptText, 'icon');

          if (img) {
              console.log('[TaskEditor] Icon generated successfully');
              const url = await uploadImage(img);
              setEditedPoint(prev => ({ ...prev, iconUrl: url || img }));
          } else {
              console.warn('[TaskEditor] AI returned null');
              alert('⚠️ Icon generation failed\n\nPlease check your Gemini API key or try again.');
          }
      } catch (error: any) {
          console.error('[TaskEditor] Error generating icon:', error);
          const errorMessage = error?.message || '';
          if (errorMessage.includes('AI API Key missing')) {
              alert('Gemini API Key is missing. Please set your API key in Local Storage.\n\nGet a free API key at https://aistudio.google.com/app/apikey');
          } else {
              alert('Error generating icon. Please try again.\n\n' + errorMessage);
          }
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

  const handleAddTag = (value?: string) => {
      const trimmedInput = (value ?? tagInput).trim();
      const existing = editedPoint.tags || [];

      const hasDuplicate = existing.some(t => t.toLowerCase() === trimmedInput.toLowerCase());
      if (!trimmedInput || hasDuplicate) {
          setTagError(true);
          return;
      }

      setEditedPoint(prev => ({ ...prev, tags: [...(prev.tags || []), trimmedInput] }));
      setTagInput('');
      setShowTagSuggestions(false);
      setTagError(false);
  };

  const handleRemoveTag = (tag: string) => {
      setEditedPoint(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  const filteredTagSuggestions = useMemo(() => {
      const q = tagInput.trim().toLowerCase();
      if (!q) return [];

      const existing = new Set((editedPoint.tags || []).map(t => t.toLowerCase()));

      return existingTags
          .filter(t => t.toLowerCase().includes(q))
          .filter(t => !existing.has(t.toLowerCase()))
          .slice(0, 8);
  }, [tagInput, existingTags, editedPoint.tags]);

  const handleSelectTagSuggestion = (tag: string) => {
      handleAddTag(tag);
  };

  const handleTagInputBlur = () => {
      window.setTimeout(() => setShowTagSuggestions(false), 150);
  };

  const getReadableTextColor = (hexColor: string): string => {
      const hex = hexColor.replace('#', '');
      if (hex.length !== 6) return '#ffffff';
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 140 ? '#0f172a' : '#ffffff';
  };

  const getTagChipVars = (tag: string) => {
      const key = tag.toLowerCase();
      const bg = tagColors[key] || '#64748b';
      const fg = getReadableTextColor(bg);
      return { ['--tag-bg' as any]: bg, ['--tag-fg' as any]: fg };
  };

  const handleAddTranslation = async (targetLanguage: string) => {
    if (!targetLanguage || isTranslating) return;

    setIsTranslating(true);
    try {
      // Prepare content to translate from the base task
      const contentToTranslate = {
        question: editedPoint.task.question,
        options: editedPoint.task.options,
        answer: editedPoint.task.answer,
        correctAnswers: editedPoint.task.correctAnswers,
        placeholder: editedPoint.task.placeholder,
        feedback: editedPoint.feedback ? {
          correctMessage: editedPoint.feedback.correctMessage,
          incorrectMessage: editedPoint.feedback.incorrectMessage,
          hint: editedPoint.feedback.hint,
        } : undefined,
      };

      // Call AI translation
      const translated = await translateTaskContent(contentToTranslate, targetLanguage);

      // Create new translation entry with approval states set to false
      const newTranslation = {
        question: translated.question,
        questionApproved: false,
        options: translated.options,
        optionsApproved: false,
        answer: translated.answer,
        answerApproved: false,
        correctAnswers: translated.correctAnswers,
        correctAnswersApproved: false,
        placeholder: translated.placeholder,
        placeholderApproved: false,
        feedback: translated.feedback ? {
          correctMessage: translated.feedback.correctMessage,
          correctMessageApproved: false,
          incorrectMessage: translated.feedback.incorrectMessage,
          incorrectMessageApproved: false,
          hint: translated.feedback.hint,
          hintApproved: false,
        } : undefined,
      };

      // Update the task with new translation
      setEditedPoint(prev => ({
        ...prev,
        task: {
          ...prev.task,
          translations: {
            ...(prev.task.translations || {}),
            [targetLanguage as any]: newTranslation,
          },
        },
      }));

      setSelectedTranslationLanguage('');
    } catch (error: any) {
      console.error('[TaskEditor] Translation error:', error);
      const errorMessage = error?.message || '';
      if (errorMessage.includes('AI API Key missing')) {
        alert('Gemini API Key is missing. Please set your API key in Settings.\n\nGet a free API key at https://aistudio.google.com/app/apikey');
      } else {
        alert('Translation failed. Please try again.\n\n' + errorMessage);
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleLanguageExpanded = (language: string) => {
    setExpandedLanguages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(language)) {
        newSet.delete(language);
      } else {
        newSet.add(language);
      }
      return newSet;
    });
  };

  const handleRemoveTranslation = (language: string) => {
    setEditedPoint(prev => {
      const newTranslations = { ...(prev.task.translations || {}) };
      delete newTranslations[language as any];
      return {
        ...prev,
        task: {
          ...prev.task,
          translations: newTranslations,
        },
      };
    });
  };

  const handleUpdateTranslationField = (language: string, field: string, value: any) => {
    setEditedPoint(prev => {
      const translations = prev.task.translations || {};
      const translation = translations[language as any];
      if (!translation) return prev;

      const updatedTranslation = { ...translation };

      // Update the field value
      if (field === 'question') {
        updatedTranslation.question = value;
      } else if (field === 'options') {
        updatedTranslation.options = value;
      } else if (field === 'answer') {
        updatedTranslation.answer = value;
      } else if (field === 'correctAnswers') {
        updatedTranslation.correctAnswers = value;
      } else if (field === 'placeholder') {
        updatedTranslation.placeholder = value;
      } else if (field === 'correctMessage') {
        updatedTranslation.feedback = {
          ...updatedTranslation.feedback!,
          correctMessage: value,
        };
      } else if (field === 'incorrectMessage') {
        updatedTranslation.feedback = {
          ...updatedTranslation.feedback!,
          incorrectMessage: value,
        };
      } else if (field === 'hint') {
        updatedTranslation.feedback = {
          ...updatedTranslation.feedback!,
          hint: value,
        };
      }

      return {
        ...prev,
        task: {
          ...prev.task,
          translations: {
            ...translations,
            [language as any]: updatedTranslation,
          },
        },
      };
    });
  };

  const handleApproveTranslationField = (language: string, field: string) => {
    setEditedPoint(prev => {
      const translations = prev.task.translations || {};
      const translation = translations[language as any];
      if (!translation) return prev;

      const updatedTranslation = { ...translation };

      // Update the approval field
      if (field === 'question') {
        updatedTranslation.questionApproved = true;
      } else if (field === 'options') {
        updatedTranslation.optionsApproved = true;
      } else if (field === 'answer') {
        updatedTranslation.answerApproved = true;
      } else if (field === 'correctAnswers') {
        updatedTranslation.correctAnswersApproved = true;
      } else if (field === 'placeholder') {
        updatedTranslation.placeholderApproved = true;
      } else if (field === 'correctMessage') {
        updatedTranslation.feedback = {
          ...updatedTranslation.feedback!,
          correctMessageApproved: true,
        };
      } else if (field === 'incorrectMessage') {
        updatedTranslation.feedback = {
          ...updatedTranslation.feedback!,
          incorrectMessageApproved: true,
        };
      } else if (field === 'hint') {
        updatedTranslation.feedback = {
          ...updatedTranslation.feedback!,
          hintApproved: true,
        };
      }

      return {
        ...prev,
        task: {
          ...prev.task,
          translations: {
            ...translations,
            [language as any]: updatedTranslation,
          },
        },
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedPoint.tags || editedPoint.tags.length === 0) {
        setTagError(true);
        setActiveTab('GENERAL');
        return;
    }

    // Validate boolean (YES/NO) tasks have an answer selected
    if (editedPoint.task.type === 'boolean' && !editedPoint.task.answer) {
        alert('❌ YES/NO tasks require a correct answer. Please select YES or NO in the GENERAL tab.');
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

    if (type === 'boolean') {
        const currentAnswer = editedPoint.task.answer;
        return (
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase flex items-center gap-2">
                    CORRECT ANSWER
                    <span className="text-red-500 text-[10px] font-black">REQUIRED</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setEditedPoint({...editedPoint, task: {...editedPoint.task, answer: 'YES'}})}
                        className={`py-3 px-6 rounded-xl font-bold uppercase text-sm transition-all border-2 ${
                            currentAnswer === 'YES'
                                ? 'bg-green-500 border-green-500 text-white shadow-lg'
                                : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'
                        }`}
                    >
                        <Check className={`w-5 h-5 mx-auto mb-1 ${currentAnswer === 'YES' ? '' : 'opacity-30'}`} />
                        YES
                    </button>
                    <button
                        type="button"
                        onClick={() => setEditedPoint({...editedPoint, task: {...editedPoint.task, answer: 'NO'}})}
                        className={`py-3 px-6 rounded-xl font-bold uppercase text-sm transition-all border-2 ${
                            currentAnswer === 'NO'
                                ? 'bg-green-500 border-green-500 text-white shadow-lg'
                                : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400'
                        }`}
                    >
                        <X className={`w-5 h-5 mx-auto mb-1 ${currentAnswer === 'NO' ? '' : 'opacity-30'}`} />
                        NO
                    </button>
                </div>
                {!currentAnswer && (
                    <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Please select the correct answer (YES or NO)
                    </p>
                )}
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
    <div className="fixed inset-0 z-[9200] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
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
                       {id: 'ANSWER', label: 'Answer', icon: MessageSquare},
                       {id: 'IMAGE', label: 'Image', icon: ImageIcon},
                       {id: 'MEDIA', label: 'Media', icon: MonitorPlay},
                       {id: 'SETTINGS', label: 'Config', icon: SlidersHorizontal},
                       {id: 'ACTIVATION', label: 'Activation', icon: Lock},
                       {id: 'TAGS', label: 'Tags', icon: Tag},
                       {id: 'LANGUAGES', label: 'Languages', icon: Globe},
                       {id: 'VIEW', label: 'View', icon: Eye},
                   ].map(tab => {
                       // Count unapproved translations for Languages tab badge
                       let unapprovedCount = 0;
                       if (tab.id === 'LANGUAGES' && editedPoint.task.translations) {
                           Object.values(editedPoint.task.translations).forEach((translation: any) => {
                               const isApproved =
                                   translation.questionApproved === true &&
                                   (translation.options ? translation.optionsApproved === true : true) &&
                                   (translation.answer ? translation.answerApproved === true : true) &&
                                   (translation.correctAnswers ? translation.correctAnswersApproved === true : true) &&
                                   (translation.feedback ? (
                                       (translation.feedback.correctMessage ? translation.feedback.correctMessageApproved === true : true) &&
                                       (translation.feedback.incorrectMessage ? translation.feedback.incorrectMessageApproved === true : true) &&
                                       (translation.feedback.hint ? translation.feedback.hintApproved === true : true)
                                   ) : true);

                               if (!isApproved) unapprovedCount++;
                           });
                       }

                       return (
                           <button
                               key={tab.id}
                               type="button"
                               onClick={() => {
                                   if (tab.id === 'VIEW') {
                                       setShowDevicePreview(true);
                                   } else {
                                       setActiveTab(tab.id as any);
                                   }
                               }}
                               className={`flex-1 py-3 text-[10px] font-black uppercase flex flex-col items-center gap-1 border-b-2 transition-all relative ${activeTab === tab.id && tab.id !== 'VIEW' ? 'border-orange-600 text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800' : 'border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                           >
                               <tab.icon className="w-4 h-4" />
                               <span className="flex items-center gap-1">
                                   {tab.label}
                                   {tab.id === 'LANGUAGES' && unapprovedCount > 0 && (
                                       <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black ml-1">
                                           NEW
                                       </span>
                                   )}
                               </span>
                           </button>
                       );
                   })}
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
                                       <span
                                           key={`${tag}-${index}`}
                                           onClick={() => setActiveTab('TAGS')}
                                           className="px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition-opacity border border-black/10 dark:border-white/10 bg-[var(--tag-bg)] text-[var(--tag-fg)] hover:opacity-90"
                                           style={getTagChipVars(tag)}
                                       >
                                           {tag}
                                           <button
                                               type="button"
                                               onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                                               className="opacity-80 hover:opacity-100"
                                           >
                                               <X className="w-3 h-3" />
                                           </button>
                                       </span>
                                   ))}
                               </div>
                               <div className="flex gap-2">
                                   <div className="relative flex-1">
                                       <input
                                          type="text"
                                          value={tagInput}
                                          onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); setTagError(false); }}
                                          onFocus={() => setShowTagSuggestions(true)}
                                          onBlur={handleTagInputBlur}
                                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                          className={`w-full px-3 py-2 border-2 ${tagError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'dark:border-gray-700 bg-gray-50 dark:bg-gray-800'} rounded-lg text-sm outline-none`}
                                          placeholder="Add tag and press Enter..."
                                       />

                                       {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                                           <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50">
                                               {filteredTagSuggestions.map((tag) => (
                                                   <button
                                                       key={tag}
                                                       type="button"
                                                       onMouseDown={(e) => e.preventDefault()}
                                                       onClick={() => handleSelectTagSuggestion(tag)}
                                                       className="w-full text-left px-3 py-2 text-[11px] font-black uppercase tracking-wide text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                   >
                                                       {tag}
                                                   </button>
                                               ))}
                                           </div>
                                       )}
                                   </div>

                                   <button type="button" onClick={() => handleAddTag()} className="px-3 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"><Plus className="w-4 h-4" /></button>
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
                                          <option value="photo">📸 PHOTO</option>
                                          <option value="video">🎥 VIDEO</option>
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
                                              {editedPoint.task.type === 'photo' && (
                                                  <><p className="font-bold text-blue-200">📸 PHOTO</p><p className="text-blue-300/80">Teams upload a photo</p><p className="italic text-blue-400">Ex: "Take a selfie at the statue"</p></>
                                              )}
                                              {editedPoint.task.type === 'video' && (
                                                  <><p className="font-bold text-blue-200">🎥 VIDEO</p><p className="text-blue-300/80">Teams record a video</p><p className="italic text-blue-400">Ex: "Record your team's challenge"</p></>
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

                   {/* MEDIA TAB - Photo/Video Task Settings */}
                   {activeTab === 'MEDIA' && (
                       <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                           {/* Only show for PHOTO/VIDEO task types */}
                           {(editedPoint.task.type === 'photo' || editedPoint.task.type === 'video') ? (
                               <>
                                   <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-4">
                                       <div className="flex items-center gap-2 mb-2">
                                           <MonitorPlay className="w-5 h-5 text-purple-400" />
                                           <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                               {editedPoint.task.type === 'photo' ? 'Photo' : 'Video'} Task Settings
                                           </h3>
                                       </div>
                                       <p className="text-xs text-purple-200">
                                           Configure how {editedPoint.task.type === 'photo' ? 'photos' : 'videos'} are submitted and approved for this task.
                                       </p>
                                   </div>

                                   {/* Approval Mode */}
                                   <div>
                                       <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-[0.2em]">Approval Mode</label>
                                       <div className="space-y-2">
                                           <button
                                               type="button"
                                               onClick={() => setEditedPoint({
                                                   ...editedPoint,
                                                   task: {
                                                       ...editedPoint.task,
                                                       mediaSettings: {
                                                           ...(editedPoint.task.mediaSettings || {}),
                                                           requireApproval: false
                                                       }
                                                   }
                                               })}
                                               className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                                   editedPoint.task.mediaSettings?.requireApproval === false
                                                       ? 'border-green-500 bg-green-900/20'
                                                       : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                               }`}
                                           >
                                               <div className="flex items-start gap-3">
                                                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                                                       editedPoint.task.mediaSettings?.requireApproval === false
                                                           ? 'border-green-500 bg-green-500'
                                                           : 'border-gray-600'
                                                   }`}>
                                                       {editedPoint.task.mediaSettings?.requireApproval === false && <Check className="w-3 h-3 text-white" />}
                                                   </div>
                                                   <div>
                                                       <div className="font-bold text-white text-sm">Auto-Approve</div>
                                                       <div className="text-xs text-gray-400 mt-1">
                                                           Teams get points immediately after submitting. No instructor review needed.
                                                       </div>
                                                   </div>
                                               </div>
                                           </button>

                                           <button
                                               type="button"
                                               onClick={() => setEditedPoint({
                                                   ...editedPoint,
                                                   task: {
                                                       ...editedPoint.task,
                                                       mediaSettings: {
                                                           ...(editedPoint.task.mediaSettings || {}),
                                                           requireApproval: true
                                                       }
                                                   }
                                               })}
                                               className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                                   editedPoint.task.mediaSettings?.requireApproval === true
                                                       ? 'border-orange-500 bg-orange-900/20'
                                                       : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                               }`}
                                           >
                                               <div className="flex items-start gap-3">
                                                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                                                       editedPoint.task.mediaSettings?.requireApproval === true
                                                           ? 'border-orange-500 bg-orange-500'
                                                           : 'border-gray-600'
                                                   }`}>
                                                       {editedPoint.task.mediaSettings?.requireApproval === true && <Check className="w-3 h-3 text-white" />}
                                                   </div>
                                                   <div>
                                                       <div className="font-bold text-white text-sm">Require Instructor Approval</div>
                                                       <div className="text-xs text-gray-400 mt-1">
                                                           Instructor/Admin must review and approve/reject submissions before teams earn points.
                                                       </div>
                                                   </div>
                                               </div>
                                           </button>
                                       </div>
                                   </div>

                                   {/* Partial Scoring (only when approval is required) */}
                                   {editedPoint.task.mediaSettings?.requireApproval && (
                                       <div>
                                           <label className="flex items-center gap-3 cursor-pointer group">
                                               <input
                                                   type="checkbox"
                                                   checked={editedPoint.task.mediaSettings?.partialScoreEnabled || false}
                                                   onChange={(e) => setEditedPoint({
                                                       ...editedPoint,
                                                       task: {
                                                           ...editedPoint.task,
                                                           mediaSettings: {
                                                               ...(editedPoint.task.mediaSettings || {}),
                                                               requireApproval: true,
                                                               partialScoreEnabled: e.target.checked
                                                           }
                                                       }
                                                   })}
                                                   className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-800 checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                                               />
                                               <div>
                                                   <span className="text-sm font-bold text-white block">Enable Partial Scoring</span>
                                                   <span className="text-xs text-gray-400">
                                                       Allow instructors to award 0-100% of points using a slider (instead of full approve/reject).
                                                   </span>
                                               </div>
                                           </label>
                                       </div>
                                   )}

                                   {/* Multiple Submissions */}
                                   <div>
                                       <label className="flex items-center gap-3 cursor-pointer group">
                                           <input
                                               type="checkbox"
                                               checked={editedPoint.task.mediaSettings?.allowMultipleSubmissions || false}
                                               onChange={(e) => setEditedPoint({
                                                   ...editedPoint,
                                                   task: {
                                                       ...editedPoint.task,
                                                       mediaSettings: {
                                                           ...(editedPoint.task.mediaSettings || { requireApproval: false }),
                                                           allowMultipleSubmissions: e.target.checked
                                                       }
                                                   }
                                               })}
                                               className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-800 checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                                           />
                                           <div>
                                               <span className="text-sm font-bold text-white block">Allow Multiple Submissions</span>
                                               <span className="text-xs text-gray-400">
                                                   Teams can submit multiple times if rejected (task reopens on map).
                                               </span>
                                           </div>
                                       </label>
                                   </div>

                                   {/* File Size Limit */}
                                   <div>
                                       <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-[0.2em]">
                                           Max File Size (MB)
                                       </label>
                                       <input
                                           type="number"
                                           min="1"
                                           max={editedPoint.task.type === 'photo' ? 50 : 200}
                                           value={editedPoint.task.mediaSettings?.maxFileSize || (editedPoint.task.type === 'photo' ? 10 : 50)}
                                           onChange={(e) => setEditedPoint({
                                               ...editedPoint,
                                               task: {
                                                   ...editedPoint.task,
                                                   mediaSettings: {
                                                       ...(editedPoint.task.mediaSettings || { requireApproval: false }),
                                                       maxFileSize: parseInt(e.target.value) || 10
                                                   }
                                               }
                                           })}
                                           className="w-full px-4 py-3 border-2 border-gray-700 rounded-xl bg-gray-800 text-white font-bold focus:border-orange-500 outline-none transition-all"
                                       />
                                       <p className="text-xs text-gray-500 mt-1">
                                           Recommended: {editedPoint.task.type === 'photo' ? '10 MB for photos' : '50 MB for videos'}
                                       </p>
                                   </div>
                               </>
                           ) : (
                               <div className="text-center py-12">
                                   <MonitorPlay className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                   <p className="text-sm font-bold text-gray-500">
                                       Media settings are only available for PHOTO and VIDEO task types.
                                   </p>
                                   <p className="text-xs text-gray-600 mt-2">
                                       Change the task type in the ANSWER tab to access these settings.
                                   </p>
                               </div>
                           )}
                       </div>
                   )}

                   {/* ... Settings and Actions Tabs ... */}
                   {activeTab === 'SETTINGS' && (
                       <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                           {/* Color Scheme Section */}
                           {!isTemplateMode && (
                               <div>
                                   <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">Task Color Scheme (Local Override)</label>
                                   <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                                       Override the default game color scheme for this specific task.
                                   </p>

                                   <button
                                       onClick={() => setShowColorSchemeEditor(true)}
                                       className={`w-full py-4 rounded-xl font-bold text-sm uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                                           editedPoint.colorScheme
                                               ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                                               : 'bg-slate-700 hover:bg-slate-600 text-white'
                                       }`}
                                   >
                                       <Palette className="w-5 h-5" />
                                       {editedPoint.colorScheme ? 'Edit Color Scheme' : 'Add Color Scheme'}
                                   </button>

                                   {editedPoint.colorScheme && (
                                       <>
                                           <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                               <div className="text-xs font-bold text-slate-400 uppercase mb-3">Current Colors</div>
                                               <div className="grid grid-cols-5 gap-2">
                                                   {Object.entries(editedPoint.colorScheme).map(([key, value]) => {
                                                       if (key === 'id' || key === 'name') return null;
                                                       return (
                                                           <div key={key} className="flex flex-col items-center gap-1">
                                                               <div
                                                                   className="w-10 h-10 rounded-lg border-2 border-slate-600"
                                                                   style={{ backgroundColor: value as string }}
                                                               />
                                                               <span className="text-[7px] text-slate-500 uppercase text-center">
                                                                   {key.replace(/([A-Z])/g, ' $1').trim()}
                                                               </span>
                                                           </div>
                                                       );
                                                   })}
                                               </div>
                                           </div>
                                           <button
                                               onClick={() => setEditedPoint({ ...editedPoint, colorScheme: undefined })}
                                               className="w-full mt-3 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-400 py-3 rounded-xl font-bold text-xs uppercase transition-all flex items-center justify-center gap-2"
                                           >
                                               <Trash2 className="w-4 h-4" />
                                               Remove Color Scheme
                                           </button>
                                       </>
                                   )}
                               </div>
                           )}
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
                                          <option key={lang} value={lang}>{getFlag(lang)} {lang}</option>
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

                          {/* ANSWER VALIDATION SETTINGS */}
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em] flex items-center gap-1">
                                      Max Attempts <Info className="w-3 h-3" title="Number of attempts allowed (0 = unlimited, default 1)" />
                                  </label>
                                  <div className="flex">
                                      <input
                                          type="number"
                                          min="0"
                                          max="99"
                                          value={editedPoint.settings?.maxAttempts ?? 1}
                                          onChange={(e) => setEditedPoint({...editedPoint, settings: {...editedPoint.settings, maxAttempts: parseInt(e.target.value) || 1 }})}
                                          className="w-full px-4 py-3 border-2 border-r-0 dark:border-gray-700 rounded-l-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium outline-none focus:border-orange-500 transition-all text-sm"
                                          placeholder="1"
                                      />
                                      <span className="bg-gray-100 dark:bg-gray-700 border-2 dark:border-gray-700 border-l-0 rounded-r-xl px-3 flex items-center text-[10px] font-bold text-gray-500 uppercase">TRIES</span>
                                  </div>
                                  <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-1">0 = unlimited attempts</p>
                              </div>

                              <div>
                                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em] flex items-center gap-1">
                                      Match Tolerance <Info className="w-3 h-3" title="How close the text answer needs to be (0-100%, default 80%)" />
                                  </label>
                                  <div className="flex">
                                      <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={editedPoint.settings?.matchTolerance ?? 80}
                                          onChange={(e) => setEditedPoint({...editedPoint, settings: {...editedPoint.settings, matchTolerance: parseInt(e.target.value) || 80 }})}
                                          className="w-full px-4 py-3 border-2 border-r-0 dark:border-gray-700 rounded-l-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-medium outline-none focus:border-orange-500 transition-all text-sm"
                                          placeholder="80"
                                      />
                                      <span className="bg-gray-100 dark:bg-gray-700 border-2 dark:border-gray-700 border-l-0 rounded-r-xl px-3 flex items-center text-[10px] font-bold text-gray-500 uppercase">%</span>
                                  </div>
                                  <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-1">100% = exact match only</p>
                              </div>
                          </div>

                          {/* TASK VISIBILITY AFTER COMPLETION */}
                          <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800">
                              <div className="flex items-start gap-4 mb-4">
                                  <div className="w-12 h-12 bg-slate-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                      <Eye className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1">
                                      <h3 className="font-black text-sm uppercase tracking-wide mb-1">Task Visibility After Completion</h3>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Control whether task stays visible on the screen after being answered correctly or incorrectly.</p>
                                  </div>
                              </div>

                              <div className="space-y-4">
                                  {/* Keep on Screen When Correct */}
                                  <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                      <div className="flex-1">
                                          <label className="block text-sm font-bold text-green-900 dark:text-green-100">Keep on Screen When Correct</label>
                                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                                              Task remains visible (grayed out) after answering correctly
                                          </p>
                                      </div>
                                      <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                          setEditedPoint({...editedPoint, keepOnScreenOnCorrect: !editedPoint.keepOnScreenOnCorrect});
                                      }}>
                                          <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.keepOnScreenOnCorrect ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                              <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.keepOnScreenOnCorrect ? 'translate-x-6' : 'translate-x-0'}`} />
                                          </div>
                                      </label>
                                  </div>

                                  {/* Keep on Screen When Incorrect */}
                                  <div className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                      <div className="flex-1">
                                          <label className="block text-sm font-bold text-red-900 dark:text-red-100">Keep on Screen When Incorrect</label>
                                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                              Task remains visible (grayed out) after answering incorrectly
                                          </p>
                                      </div>
                                      <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                          setEditedPoint({...editedPoint, keepOnScreenOnIncorrect: !editedPoint.keepOnScreenOnIncorrect});
                                      }}>
                                          <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.keepOnScreenOnIncorrect ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                              <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.keepOnScreenOnIncorrect ? 'translate-x-6' : 'translate-x-0'}`} />
                                          </div>
                                      </label>
                                  </div>

                                  {/* Show Badge on Grayed Task */}
                                  {(editedPoint.keepOnScreenOnCorrect || editedPoint.keepOnScreenOnIncorrect) && (
                                      <div className="flex items-center justify-between p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                          <div className="flex-1">
                                              <label className="block text-sm font-bold text-blue-900 dark:text-blue-100">Show Badge on Grayed Task</label>
                                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                                  Display ✓/✗ badge on the task icon when grayed out
                                              </p>
                                          </div>
                                          <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                              setEditedPoint({...editedPoint, showBadgeOnGrayedTask: !editedPoint.showBadgeOnGrayedTask});
                                          }}>
                                              <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.showBadgeOnGrayedTask ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                                  <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.showBadgeOnGrayedTask ? 'translate-x-6' : 'translate-x-0'}`} />
                                              </div>
                                          </label>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* TIME-BOMB CONFIGURATION */}
                          <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-6 rounded-2xl border-2 border-red-200 dark:border-red-800">
                              <div className="flex items-start gap-4 mb-4">
                                   <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                       <Clock className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                       <h3 className="font-black text-sm uppercase tracking-wide mb-1">Time-Bomb Mode</h3>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Add countdown timer that penalizes or auto-fails the task if not completed in time.</p>

                                       <label className="flex items-center gap-3 cursor-pointer" onClick={() => {
                                           setEditedPoint({...editedPoint, timeBombEnabled: !editedPoint.timeBombEnabled});
                                       }}>
                                           <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.timeBombEnabled ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                               <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.timeBombEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                           </div>
                                           <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                               {editedPoint.timeBombEnabled ? 'ENABLED' : 'DISABLED'}
                                           </span>
                                       </label>
                                   </div>
                               </div>

                               {editedPoint.timeBombEnabled && (
                                   <div className="space-y-4 pt-4 border-t border-red-200 dark:border-red-700">
                                       {/* Duration */}
                                       <div>
                                           <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                               Countdown Duration (seconds)
                                           </label>
                                           <input
                                               type="number"
                                               min="10"
                                               max="3600"
                                               step="10"
                                               value={editedPoint.timeBombDuration || 300}
                                               onChange={(e) => setEditedPoint({...editedPoint, timeBombDuration: parseInt(e.target.value) || 300})}
                                               className="w-full px-4 py-3 border-2 border-red-300 dark:border-red-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                           />
                                           <p className="text-[9px] text-gray-500 mt-1">
                                               = {Math.floor((editedPoint.timeBombDuration || 300) / 60)} minutes {(editedPoint.timeBombDuration || 300) % 60} seconds
                                           </p>
                                       </div>

                                       {/* Start Trigger */}
                                       <div>
                                           <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                               Timer Starts When
                                           </label>
                                           <select
                                               value={editedPoint.timeBombStartTrigger || 'onUnlock'}
                                               onChange={(e) => setEditedPoint({...editedPoint, timeBombStartTrigger: e.target.value as any})}
                                               className="w-full px-4 py-3 border-2 border-red-300 dark:border-red-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                           >
                                               <option value="onUnlock">Task is Unlocked</option>
                                               <option value="onActivate">Task is Opened/Activated</option>
                                               <option value="manual">Manual Start (GM Control)</option>
                                           </select>
                                       </div>

                                       {/* Penalty */}
                                       <div>
                                           <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                               Score Penalty (if timer expires)
                                           </label>
                                           <input
                                               type="number"
                                               min="-1000"
                                               max="0"
                                               step="10"
                                               value={editedPoint.timeBombPenalty || -100}
                                               onChange={(e) => setEditedPoint({...editedPoint, timeBombPenalty: parseInt(e.target.value) || -100})}
                                               className="w-full px-4 py-3 border-2 border-red-300 dark:border-red-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                                           />
                                           <p className="text-[9px] text-gray-500 mt-1">
                                               Negative points applied when time runs out
                                           </p>
                                       </div>

                                       {/* Auto-Fail Option */}
                                       <div className="flex items-center gap-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                           <label className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => {
                                               setEditedPoint({...editedPoint, timeBombAutoFail: !editedPoint.timeBombAutoFail});
                                           }}>
                                               <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.timeBombAutoFail ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                                   <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.timeBombAutoFail ? 'translate-x-6' : 'translate-x-0'}`} />
                                               </div>
                                               <div>
                                                   <span className="text-xs font-bold text-red-900 dark:text-red-100 block">Auto-Fail on Expiry</span>
                                                   <span className="text-[9px] text-red-700 dark:text-red-300">
                                                       Task becomes impossible to complete after timer expires
                                                   </span>
                                               </div>
                                           </label>
                                       </div>

                                       {/* Preview */}
                                       <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3">
                                           <p className="text-xs text-red-900 dark:text-red-200 font-bold">
                                               💣 <strong>Preview:</strong> Teams will have {Math.floor((editedPoint.timeBombDuration || 300) / 60)}:{((editedPoint.timeBombDuration || 300) % 60).toString().padStart(2, '0')} to complete this task or face {editedPoint.timeBombAutoFail ? 'automatic failure' : `a ${editedPoint.timeBombPenalty || -100} point penalty`}.
                                           </p>
                                       </div>
                                   </div>
                               )}
                           </div>

                           {/* MULTI-TEAM COLLABORATION CONFIGURATION */}
                           <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border-2 border-purple-200 dark:border-purple-800">
                               <div className="flex items-start gap-4 mb-4">
                                   <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                       <Users className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                       <h3 className="font-black text-sm uppercase tracking-wide mb-1">Multi-Team Challenge</h3>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Require multiple teams to be in proximity to activate or complete this task together.</p>

                                       <label className="flex items-center gap-3 cursor-pointer" onClick={() => {
                                           setEditedPoint({...editedPoint, multiTeamEnabled: !editedPoint.multiTeamEnabled});
                                       }}>
                                           <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.multiTeamEnabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                               <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.multiTeamEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                           </div>
                                           <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                               {editedPoint.multiTeamEnabled ? 'ENABLED' : 'DISABLED'}
                                           </span>
                                       </label>
                                   </div>
                               </div>

                               {editedPoint.multiTeamEnabled && (
                                   <div className="space-y-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                                       {/* Required Team Count */}
                                       <div>
                                           <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                               Required Teams
                                           </label>
                                           <input
                                               type="number"
                                               min="2"
                                               max="10"
                                               value={editedPoint.multiTeamRequiredCount || 2}
                                               onChange={(e) => setEditedPoint({...editedPoint, multiTeamRequiredCount: parseInt(e.target.value) || 2})}
                                               className="w-full px-4 py-3 border-2 border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                           />
                                           <p className="text-[9px] text-gray-500 mt-1">
                                               Number of teams that must be present (minimum 2)
                                           </p>
                                       </div>

                                       {/* Proximity Radius */}
                                       <div>
                                           <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                               Proximity Radius (meters)
                                           </label>
                                           <input
                                               type="number"
                                               min="10"
                                               max="200"
                                               step="5"
                                               value={editedPoint.multiTeamRadius || 50}
                                               onChange={(e) => setEditedPoint({...editedPoint, multiTeamRadius: parseInt(e.target.value) || 50})}
                                               className="w-full px-4 py-3 border-2 border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                           />
                                           <p className="text-[9px] text-gray-500 mt-1">
                                               All teams must be within this distance of the task
                                           </p>
                                       </div>

                                       {/* Completion Mode */}
                                       <div>
                                           <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                               Completion Mode
                                           </label>
                                           <select
                                               value={editedPoint.multiTeamCompletionMode || 'all'}
                                               onChange={(e) => setEditedPoint({...editedPoint, multiTeamCompletionMode: e.target.value as any})}
                                               className="w-full px-4 py-3 border-2 border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                           >
                                               <option value="all">All Teams Complete Together</option>
                                               <option value="first">First Team Triggers for All</option>
                                           </select>
                                           <p className="text-[9px] text-gray-500 mt-1">
                                               {editedPoint.multiTeamCompletionMode === 'all'
                                                 ? 'Teams must solve together and share points'
                                                 : 'First team to solve triggers completion for all nearby teams'}
                                           </p>
                                       </div>

                                       {/* Preview */}
                                       <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-3">
                                           <p className="text-xs text-purple-900 dark:text-purple-200 font-bold">
                                               🤝 <strong>Preview:</strong> This task requires {editedPoint.multiTeamRequiredCount || 2} teams within {editedPoint.multiTeamRadius || 50}m to {editedPoint.multiTeamCompletionMode === 'all' ? 'collaborate and complete together' : 'trigger activation'}.
                                           </p>
                                       </div>
                                   </div>
                               )}
                           </div>
                       </div>
                   )}

                   {activeTab === 'ANSWER' && (
                       <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
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
                       </div>
                   )}

                   {activeTab === 'ACTIVATION' && (
                       <div className="space-y-6">
                           {/* Playzone Game Warning */}
                           {gameMode === 'playzone' && (
                               <div className="bg-teal-100 dark:bg-teal-900/30 border-2 border-teal-400 dark:border-teal-600 p-4 rounded-xl">
                                   <p className="text-sm font-bold text-teal-900 dark:text-teal-200">
                                       📱 <strong>PLAYZONE MODE</strong>: GPS activations are disabled for indoor games. Use QR, NFC, iBeacon, or Click methods instead.
                                   </p>
                               </div>
                           )}

                           {/* GPS LOCATION - PRIMARY ACTIVATION (Always enabled by default) - Hidden for Playzone */}
                           {gameMode !== 'playzone' && (
                           <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 p-6 rounded-2xl border-2 border-green-200 dark:border-green-800">
                               <button
                                   type="button"
                                   onClick={() => setExpandedActivations({...expandedActivations, location: !expandedActivations.location})}
                                   className="w-full flex items-start gap-4 text-left hover:opacity-80 transition-opacity"
                               >
                                   <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                       <MapIcon className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                       <div className="flex items-center justify-between">
                                           <div className="flex items-center gap-2">
                                               <h3 className="font-black text-sm uppercase tracking-wide">GPS Geofence Location</h3>
                                               <span className="bg-green-600 text-white text-[8px] px-2 py-1 rounded font-bold">PRIMARY</span>
                                           </div>
                                           <ChevronDown className={`w-5 h-5 text-green-600 transition-transform ${expandedActivations.location ? 'rotate-180' : ''}`} />
                                       </div>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Lock this task to a specific GPS location with configurable radius.</p>
                                   </div>
                               </button>

                               {expandedActivations.location && (
                                   <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
                                       <div className="space-y-3">
                                           <div className="flex items-center gap-3 mb-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                               <div className="flex-1">
                                                   <label className="block text-[10px] font-bold text-green-700 dark:text-green-300 uppercase mb-2">GPS ENABLED</label>
                                                   <p className="text-[9px] text-green-600 dark:text-green-400">This task can always be solved using GPS geofencing. Disable only with explicit confirmation.</p>
                                               </div>
                                               <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                                   const hasGps = editedPoint.activationTypes.includes('radius');
                                                   if (hasGps) {
                                                       const confirmed = window.confirm('⚠️ Disable GPS activation? Task must have at least one activation method enabled.');
                                                       if (confirmed) {
                                                           setEditedPoint({...editedPoint, activationTypes: editedPoint.activationTypes.filter(t => t !== 'radius')});
                                                       }
                                                   } else {
                                                       setEditedPoint({...editedPoint, activationTypes: [...editedPoint.activationTypes, 'radius']});
                                                   }
                                               }}>
                                                   <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.activationTypes.includes('radius') ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                                       <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.activationTypes.includes('radius') ? 'translate-x-6' : 'translate-x-0'}`} />
                                                   </div>
                                               </label>
                                           </div>

                                           {editedPoint.activationTypes.includes('radius') && editedPoint.location ? (
                                               <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-green-200 dark:border-green-700">
                                                   <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">📍 CURRENT LOCATION</p>
                                                   <p className="text-sm font-mono text-gray-900 dark:text-white mb-3">{editedPoint.location.lat.toFixed(6)}, {editedPoint.location.lng.toFixed(6)}</p>

                                                   <div className="mb-4">
                                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">⭕ RADIUS: {editedPoint.radiusMeters}m</label>
                                                       <input
                                                           type="range"
                                                           min="10"
                                                           max="500"
                                                           step="10"
                                                           value={editedPoint.radiusMeters || 50}
                                                           onChange={(e) => setEditedPoint({...editedPoint, radiusMeters: parseInt(e.target.value)})}
                                                           className="w-full h-2 bg-green-200 dark:bg-green-800 rounded-lg appearance-none cursor-pointer accent-green-600"
                                                       />
                                                       <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                                                           <span>10m</span>
                                                           <span>500m</span>
                                                       </div>
                                                   </div>

                                                   <button
                                                       type="button"
                                                       onClick={() => setShowMapPicker(true)}
                                                       className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 mb-3"
                                                   >
                                                       <MapPin className="w-5 h-5" />
                                                       SELECT ON MAP
                                                   </button>

                                                   <button
                                                       type="button"
                                                       onClick={() => setEditedPoint({...editedPoint, isLocationLocked: !editedPoint.isLocationLocked})}
                                                       className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 ${editedPoint.isLocationLocked ? 'bg-green-600 text-white border-green-700 shadow-lg shadow-green-500/30' : 'bg-white dark:bg-gray-800 text-green-600 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-gray-700'}`}
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
                                                       <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3 mt-3">
                                                           <p className="text-xs text-green-900 dark:text-green-200 font-bold">
                                                               ✓ This task is locked to this location. Players must be within {editedPoint.radiusMeters}m to solve it.
                                                           </p>
                                                       </div>
                                                   )}
                                               </div>
                                           ) : (
                                               <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
                                                   <p className="text-xs text-yellow-900 dark:text-yellow-200 font-bold mb-3">
                                                       ⚠️ This task doesn't have a location set yet.
                                                   </p>
                                                   <button
                                                       type="button"
                                                       onClick={() => setShowMapPicker(true)}
                                                       className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <MapPin className="w-4 h-4" />
                                                       SELECT LOCATION ON MAP
                                                   </button>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               )}
                           </div>
                          )}

                          {/* PROXIMITY TRIGGER - DISCOVERY MECHANIC */}
                          {gameMode !== 'playzone' && (
                          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-6 rounded-2xl border-2 border-cyan-200 dark:border-cyan-800">
                              <button
                                  type="button"
                                  onClick={() => setExpandedActivations({...expandedActivations, proximity: !expandedActivations.proximity})}
                                  className="w-full flex items-start gap-4 text-left hover:opacity-80 transition-opacity"
                              >
                                  <div className="w-12 h-12 bg-cyan-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                      <Eye className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                              <h3 className="font-black text-sm uppercase tracking-wide">Proximity Trigger</h3>
                                              <span className="bg-cyan-600 text-white text-[8px] px-2 py-1 rounded font-bold">DISCOVERY</span>
                                          </div>
                                          <ChevronDown className={`w-5 h-5 text-cyan-600 transition-transform ${expandedActivations.proximity ? 'rotate-180' : ''}`} />
                                      </div>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Hide this task until players get close enough to discover it.</p>
                                  </div>
                              </button>

                              {expandedActivations.proximity && (
                                  <div className="mt-4 pt-4 border-t border-cyan-200 dark:border-cyan-700">
                                      <div className="space-y-3">
                                          <div className="flex items-center gap-3 mb-4 p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                                              <div className="flex-1">
                                                  <label className="block text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase mb-2">PROXIMITY TRIGGER</label>
                                                  <p className="text-[9px] text-cyan-600 dark:text-cyan-400">When enabled, this task stays invisible until players enter the discovery radius.</p>
                                              </div>
                                              <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                                  setEditedPoint({...editedPoint, proximityTriggerEnabled: !editedPoint.proximityTriggerEnabled});
                                              }}>
                                                  <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.proximityTriggerEnabled ? 'bg-cyan-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                                      <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.proximityTriggerEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                                  </div>
                                              </label>
                                          </div>

                                          {editedPoint.proximityTriggerEnabled && (
                                              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-cyan-200 dark:border-cyan-700 space-y-4">
                                                  <div>
                                                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">
                                                          👁️ REVEAL RADIUS: {editedPoint.proximityRevealRadius || 100}m
                                                      </label>
                                                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-2">
                                                          Distance at which the task becomes visible to players
                                                      </p>
                                                      <input
                                                          type="range"
                                                          min="20"
                                                          max="500"
                                                          step="10"
                                                          value={editedPoint.proximityRevealRadius || 100}
                                                          onChange={(e) => setEditedPoint({...editedPoint, proximityRevealRadius: parseInt(e.target.value)})}
                                                          className="w-full h-2 bg-cyan-200 dark:bg-cyan-800 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                                      />
                                                      <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                                                          <span>20m</span>
                                                          <span>500m</span>
                                                      </div>
                                                  </div>

                                                  <div className="flex items-center gap-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                                                      <div className="flex-1">
                                                          <label className="block text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase mb-1">STAYS VISIBLE</label>
                                                          <p className="text-[9px] text-cyan-600 dark:text-cyan-400">Once discovered, task remains visible even if player leaves the area</p>
                                                      </div>
                                                      <label className="flex items-center gap-2 cursor-pointer" onClick={() => {
                                                          setEditedPoint({...editedPoint, proximityStaysVisible: editedPoint.proximityStaysVisible !== false ? false : true});
                                                      }}>
                                                          <div className={`w-12 h-7 rounded-full transition-all ${editedPoint.proximityStaysVisible !== false ? 'bg-cyan-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                                              <div className={`w-6 h-6 bg-white rounded-full transition-all transform ${editedPoint.proximityStaysVisible !== false ? 'translate-x-6' : 'translate-x-0'}`} />
                                                          </div>
                                                      </label>
                                                  </div>

                                                  <div className="bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-300 dark:border-cyan-700 rounded-lg p-3">
                                                      <p className="text-xs text-cyan-900 dark:text-cyan-200 font-bold">
                                                          💡 <strong>Discovery Mechanic:</strong> This creates an exploration element where players must physically move around to discover hidden tasks. Perfect for treasure hunts and adventure games!
                                                      </p>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>
                          )}

                          {/* OTHER ACTIVATION METHODS */}

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
                                                   onChange={(e) => {
                                                       setEditedPoint({...editedPoint, qrCodeString: e.target.value});
                                                       setQrCodeDuplicateWarning(false); // Clear warning on input change
                                                   }}
                                                   placeholder="e.g., HOUSE_001, LOCATION_ALPHA, or any unique identifier"
                                                   className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:border-purple-500 outline-none transition-all ${qrCodeDuplicateWarning ? 'border-red-500' : 'border-purple-200 dark:border-purple-700'}`}
                                               />
                                               <p className="text-[10px] text-gray-500 mt-2">This is the value that will be encoded in the QR code.</p>
                                               {qrCodeDuplicateWarning && (
                                                   <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-2 mt-2">
                                                       <p className="text-[10px] text-red-700 dark:text-red-300 font-bold">
                                                           ⚠️ This QR code string is already used by another task in this game. Each QR code must be unique.
                                                       </p>
                                                   </div>
                                               )}
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

                           {/* NFC Configuration */}
                           <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-2xl border-2 border-green-200 dark:border-green-800">
                               <div className="flex items-start gap-4">
                                   <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                       <Smartphone className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                       <h3 className="font-black text-sm uppercase tracking-wide mb-1">NFC Tag Activation</h3>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Enable this task to be unlocked by scanning an NFC tag. Perfect for physical locations like house doors, information boards, etc.</p>

                                       <div className="space-y-3">
                                           <div>
                                               <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">🏷️ NFC TAG ID</label>
                                               <input
                                                   type="text"
                                                   value={editedPoint.nfcTagId || ''}
                                                   onChange={(e) => setEditedPoint({...editedPoint, nfcTagId: e.target.value})}
                                                   placeholder="e.g., NFC_HOUSE_A, BEACON_LOCATION_1"
                                                   className="w-full px-4 py-3 border-2 border-green-200 dark:border-green-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:border-green-500 outline-none transition-all"
                                               />
                                               <p className="text-[10px] text-gray-500 mt-2">Unique identifier for this NFC tag.</p>
                                           </div>

                                           <div>
                                               <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">📝 NFC TAG DATA (Optional)</label>
                                               <textarea
                                                   value={editedPoint.nfcTagData || ''}
                                                   onChange={(e) => setEditedPoint({...editedPoint, nfcTagData: e.target.value})}
                                                   placeholder="Additional data to store (JSON format recommended)"
                                                   className="w-full px-4 py-3 border-2 border-green-200 dark:border-green-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-green-500 outline-none transition-all"
                                                   rows={2}
                                               />
                                               <p className="text-[10px] text-gray-500 mt-2">Store extra data like location coordinates, timestamps, etc.</p>
                                           </div>

                                           {editedPoint.nfcTagId && (
                                               <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
                                                   <p className="text-xs text-green-900 dark:text-green-200 font-bold">
                                                       ✓ This task can be unlocked by scanning an NFC tag with ID: <strong>{editedPoint.nfcTagId}</strong>
                                                   </p>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               </div>
                           </div>

                           {/* iBeacon Configuration */}
                           <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800">
                               <div className="flex items-start gap-4">
                                   <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                                       <Wifi className="w-6 h-6" />
                                   </div>
                                   <div className="flex-1">
                                       <h3 className="font-black text-sm uppercase tracking-wide mb-1">iBeacon Activation</h3>
                                       <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Enable this task to be unlocked when a player enters proximity of a specific iBeacon. Works with Bluetooth LE beacons.</p>

                                       <div className="space-y-3">
                                           <div className="grid grid-cols-1 gap-3">
                                               <div>
                                                   <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">📡 iBeacon UUID</label>
                                                   <input
                                                       type="text"
                                                       value={editedPoint.ibeaconUUID || ''}
                                                       onChange={(e) => setEditedPoint({...editedPoint, ibeaconUUID: e.target.value})}
                                                       placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
                                                       className="w-full px-4 py-3 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs focus:border-indigo-500 outline-none transition-all"
                                                   />
                                               </div>

                                               <div className="grid grid-cols-2 gap-3">
                                                   <div>
                                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">MAJOR</label>
                                                       <input
                                                           type="number"
                                                           value={editedPoint.ibeaconMajor || ''}
                                                           onChange={(e) => setEditedPoint({...editedPoint, ibeaconMajor: parseInt(e.target.value) || undefined})}
                                                           placeholder="0-65535"
                                                           className="w-full px-4 py-3 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:border-indigo-500 outline-none transition-all"
                                                       />
                                                   </div>

                                                   <div>
                                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">MINOR</label>
                                                       <input
                                                           type="number"
                                                           value={editedPoint.ibeaconMinor || ''}
                                                           onChange={(e) => setEditedPoint({...editedPoint, ibeaconMinor: parseInt(e.target.value) || undefined})}
                                                           placeholder="0-65535"
                                                           className="w-full px-4 py-3 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:border-indigo-500 outline-none transition-all"
                                                       />
                                                   </div>
                                               </div>

                                               <div>
                                                   <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">⚡ PROXIMITY TO TRIGGER</label>
                                                   <select
                                                       value={editedPoint.ibeaconProximity || 'near'}
                                                       onChange={(e) => setEditedPoint({...editedPoint, ibeaconProximity: e.target.value as any})}
                                                       className="w-full px-4 py-3 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:border-indigo-500 outline-none transition-all"
                                                   >
                                                       <option value="immediate">🟢 Immediate (0-1 meter)</option>
                                                       <option value="near">🟡 Near (1-3 meters)</option>
                                                       <option value="far">🔴 Far (3+ meters)</option>
                                                   </select>
                                               </div>
                                           </div>

                                           {editedPoint.ibeaconUUID && (
                                               <div className="bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 rounded-lg p-3">
                                                   <p className="text-xs text-indigo-900 dark:text-indigo-200 font-bold mb-1">
                                                       ✓ iBeacon configured
                                                   </p>
                                                   <p className="text-[10px] text-indigo-800 dark:text-indigo-300">
                                                       UUID: <code className="text-[9px]">{editedPoint.ibeaconUUID}</code>
                                                       {editedPoint.ibeaconMajor !== undefined && ` | Major: ${editedPoint.ibeaconMajor}`}
                                                       {editedPoint.ibeaconMinor !== undefined && ` | Minor: ${editedPoint.ibeaconMinor}`}
                                                       {editedPoint.ibeaconProximity && ` | Proximity: ${editedPoint.ibeaconProximity}`}
                                                   </p>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               </div>
                           </div>
                       </div>
                   )}

                   {activeTab === 'TAGS' && (
                       <div className="space-y-6">
                           <div>
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">MANAGE TASK TAGS</label>
                               <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Add or remove tags to organize and categorize this task.</p>

                               {/* Current Tags */}
                               {editedPoint.tags.length > 0 && (
                                   <div className="mb-6">
                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">CURRENT TAGS ({editedPoint.tags.length})</label>
                                       <div className="flex flex-wrap gap-2">
                                           {editedPoint.tags.map((tag, idx) => (
                                               <div
                                                   key={`${tag}-${idx}`}
                                                   className="flex items-center gap-2 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 bg-[var(--tag-bg)] text-[var(--tag-fg)]"
                                                   style={getTagChipVars(tag)}
                                               >
                                                   <span className="text-sm font-black">{tag}</span>
                                                   <button
                                                       type="button"
                                                       onClick={() => setEditedPoint({
                                                           ...editedPoint,
                                                           tags: editedPoint.tags.filter((_, i) => i !== idx)
                                                       })}
                                                       className="opacity-80 hover:opacity-100 transition-opacity"
                                                       title="Remove tag"
                                                   >
                                                       <X className="w-4 h-4" />
                                                   </button>
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                               )}

                               {/* Add New Tag */}
                               <div className="space-y-3">
                                   <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">ADD NEW TAG</label>
                                   <div className="flex gap-2">
                                       <div className="relative flex-1">
                                           <input
                                               type="text"
                                               value={tagInput}
                                               onChange={(e) => {
                                                   setTagInput(e.target.value);
                                                   setShowTagSuggestions(true);
                                                   setTagError(false);
                                               }}
                                               onFocus={() => setShowTagSuggestions(true)}
                                               onBlur={handleTagInputBlur}
                                               onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                               placeholder="Type tag name and press Enter..."
                                               className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:outline-none transition-all ${tagError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-blue-500'}`}
                                           />

                                           {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                                               <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                                                   {filteredTagSuggestions.map((tag) => (
                                                       <button
                                                           key={tag}
                                                           type="button"
                                                           onMouseDown={(e) => e.preventDefault()}
                                                           onClick={() => handleSelectTagSuggestion(tag)}
                                                           className="w-full text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                       >
                                                           {tag}
                                                       </button>
                                                   ))}
                                               </div>
                                           )}
                                       </div>

                                       <button
                                           type="button"
                                           onClick={() => handleAddTag()}
                                           className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide transition-colors flex items-center gap-2"
                                       >
                                           <Plus className="w-4 h-4" />
                                           ADD
                                       </button>
                                   </div>
                                   {tagError && (
                                       <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
                                           <p className="text-xs text-red-700 dark:text-red-300 font-bold">
                                               ⚠️ This tag already exists for this task or is empty.
                                           </p>
                                       </div>
                                   )}
                               </div>
                           </div>
                       </div>
                   )}

                   {activeTab === 'LANGUAGES' && (
                       <div className="space-y-6">
                           <div>
                               <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">MANAGE TRANSLATIONS</label>
                               <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                                   Add translations to make this task available in multiple languages. AI will translate the content for you.
                               </p>

                               {/* Warning about content changes */}
                               {editedPoint.task.translations && Object.keys(editedPoint.task.translations).length > 0 && (
                                   <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
                                       <div className="flex items-start gap-2">
                                           <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                           <div className="text-xs text-amber-800 dark:text-amber-200">
                                               <p className="font-bold mb-1">⚠️ Auto-Invalidation</p>
                                               <p className="text-amber-700 dark:text-amber-300">
                                                   If you change the question, answers, or feedback in the main language, all translations will automatically be marked as "NEEDS REVIEW" to ensure accuracy.
                                               </p>
                                           </div>
                                       </div>
                                   </div>
                               )}

                               {/* Current Translations */}
                               {editedPoint.task.translations && Object.keys(editedPoint.task.translations).length > 0 && (
                                   <div className="mb-6">
                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">
                                           AVAILABLE TRANSLATIONS ({Object.keys(editedPoint.task.translations).length})
                                       </label>
                                       <div className="space-y-4">
                                           {Object.entries(editedPoint.task.translations).map(([language, translation]) => {
                                               const allApproved =
                                                   translation.questionApproved === true &&
                                                   (translation.options ? translation.optionsApproved === true : true) &&
                                                   (translation.answer ? translation.answerApproved === true : true) &&
                                                   (translation.correctAnswers ? translation.correctAnswersApproved === true : true) &&
                                                   (translation.placeholder ? translation.placeholderApproved === true : true) &&
                                                   (translation.feedback ? (
                                                       (translation.feedback.correctMessage ? translation.feedback.correctMessageApproved === true : true) &&
                                                       (translation.feedback.incorrectMessage ? translation.feedback.incorrectMessageApproved === true : true) &&
                                                       (translation.feedback.hint ? translation.feedback.hintApproved === true : true)
                                                   ) : true);

                                               const isExpanded = expandedLanguages.has(language);

                                               return (
                                                   <div
                                                       key={language}
                                                       className="border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden"
                                                   >
                                                       {/* Clickable Header */}
                                                       <div
                                                           className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                           onClick={() => toggleLanguageExpanded(language)}
                                                       >
                                                           <div className="flex items-center gap-3">
                                                               <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                               <span className="text-2xl">{getFlag(language)}</span>
                                                               <span className="text-sm font-black uppercase">{language}</span>
                                                               {!allApproved && (
                                                                   <span className="bg-red-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase">
                                                                       NEEDS REVIEW
                                                                   </span>
                                                               )}
                                                               {allApproved && (
                                                                   <span className="bg-green-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase flex items-center gap-1">
                                                                       <CheckCircle className="w-3 h-3" /> APPROVED
                                                                   </span>
                                                               )}
                                                           </div>
                                                           <button
                                                               type="button"
                                                               onClick={(e) => {
                                                                   e.stopPropagation();
                                                                   handleRemoveTranslation(language);
                                                               }}
                                                               className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                               title="Remove translation"
                                                           >
                                                               <Trash2 className="w-4 h-4" />
                                                           </button>
                                                       </div>

                                                       {/* Collapsible Content */}
                                                       {isExpanded && (
                                                           <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700">
                                                               {/* Question Field */}
                                                               <div className="space-y-3">
                                                           <div className={`p-3 rounded-lg ${translation.questionApproved === false ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}>
                                                               <div className="flex items-center justify-between mb-2">
                                                                   <label className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase">Question</label>
                                                                   {translation.questionApproved === false ? (
                                                                       <button
                                                                           type="button"
                                                                           onClick={() => handleApproveTranslationField(language, 'question')}
                                                                           className="bg-green-600 hover:bg-green-700 text-white text-[8px] px-2 py-1 rounded font-black uppercase flex items-center gap-1 transition-colors"
                                                                       >
                                                                           <Check className="w-3 h-3" /> APPROVE
                                                                       </button>
                                                                   ) : (
                                                                       <span className="text-[8px] text-green-600 dark:text-green-400 font-black flex items-center gap-1">
                                                                           <CheckCircle className="w-3 h-3" /> APPROVED
                                                                       </span>
                                                                   )}
                                                               </div>
                                                               {translation.questionApproved === false ? (
                                                                   <textarea
                                                                       value={translation.question}
                                                                       onChange={(e) => handleUpdateTranslationField(language, 'question', e.target.value)}
                                                                       className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none resize-none"
                                                                       rows={3}
                                                                   />
                                                               ) : (
                                                                   <p className="text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(translation.question) }} />
                                                               )}
                                                           </div>

                                                           {/* Options Field (if exists) */}
                                                           {translation.options && translation.options.length > 0 && (
                                                               <div className={`p-3 rounded-lg ${translation.optionsApproved === false ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}>
                                                                   <div className="flex items-center justify-between mb-2">
                                                                       <label className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase">Options</label>
                                                                       {translation.optionsApproved === false ? (
                                                                           <button
                                                                               type="button"
                                                                               onClick={() => handleApproveTranslationField(language, 'options')}
                                                                               className="bg-green-600 hover:bg-green-700 text-white text-[8px] px-2 py-1 rounded font-black uppercase flex items-center gap-1 transition-colors"
                                                                           >
                                                                               <Check className="w-3 h-3" /> APPROVE
                                                                           </button>
                                                                       ) : (
                                                                           <span className="text-[8px] text-green-600 dark:text-green-400 font-black flex items-center gap-1">
                                                                               <CheckCircle className="w-3 h-3" /> APPROVED
                                                                           </span>
                                                                       )}
                                                                   </div>
                                                                   {translation.optionsApproved === false ? (
                                                                       <div className="space-y-2">
                                                                           {translation.options.map((opt, idx) => (
                                                                               <input
                                                                                   key={idx}
                                                                                   type="text"
                                                                                   value={opt}
                                                                                   onChange={(e) => {
                                                                                       const newOptions = [...translation.options!];
                                                                                       newOptions[idx] = e.target.value;
                                                                                       handleUpdateTranslationField(language, 'options', newOptions);
                                                                                   }}
                                                                                   className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none"
                                                                               />
                                                                           ))}
                                                                       </div>
                                                                   ) : (
                                                                       <ul className="space-y-1">
                                                                           {translation.options.map((opt, idx) => (
                                                                               <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">• {opt}</li>
                                                                           ))}
                                                                       </ul>
                                                                   )}
                                                               </div>
                                                           )}

                                                           {/* Feedback Field (if exists) */}
                                                           {translation.feedback && (
                                                               <div className="space-y-2">
                                                                   <div className={`p-3 rounded-lg ${translation.feedback.correctMessageApproved === false ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}>
                                                                       <div className="flex items-center justify-between mb-2">
                                                                           <label className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase">Correct Message</label>
                                                                           {translation.feedback.correctMessageApproved === false ? (
                                                                               <button
                                                                                   type="button"
                                                                                   onClick={() => handleApproveTranslationField(language, 'correctMessage')}
                                                                                   className="bg-green-600 hover:bg-green-700 text-white text-[8px] px-2 py-1 rounded font-black uppercase flex items-center gap-1 transition-colors"
                                                                               >
                                                                                   <Check className="w-3 h-3" /> APPROVE
                                                                               </button>
                                                                           ) : (
                                                                               <span className="text-[8px] text-green-600 dark:text-green-400 font-black flex items-center gap-1">
                                                                                   <CheckCircle className="w-3 h-3" /> APPROVED
                                                                               </span>
                                                                           )}
                                                                       </div>
                                                                       {translation.feedback.correctMessageApproved === false ? (
                                                                           <input
                                                                               type="text"
                                                                               value={translation.feedback.correctMessage}
                                                                               onChange={(e) => handleUpdateTranslationField(language, 'correctMessage', e.target.value)}
                                                                               className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none"
                                                                           />
                                                                       ) : (
                                                                           <p className="text-sm text-gray-700 dark:text-gray-300">{translation.feedback.correctMessage}</p>
                                                                       )}
                                                                   </div>

                                                                   <div className={`p-3 rounded-lg ${translation.feedback.incorrectMessageApproved === false ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}>
                                                                       <div className="flex items-center justify-between mb-2">
                                                                           <label className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase">Incorrect Message</label>
                                                                           {translation.feedback.incorrectMessageApproved === false ? (
                                                                               <button
                                                                                   type="button"
                                                                                   onClick={() => handleApproveTranslationField(language, 'incorrectMessage')}
                                                                                   className="bg-green-600 hover:bg-green-700 text-white text-[8px] px-2 py-1 rounded font-black uppercase flex items-center gap-1 transition-colors"
                                                                               >
                                                                                   <Check className="w-3 h-3" /> APPROVE
                                                                               </button>
                                                                           ) : (
                                                                               <span className="text-[8px] text-green-600 dark:text-green-400 font-black flex items-center gap-1">
                                                                                   <CheckCircle className="w-3 h-3" /> APPROVED
                                                                               </span>
                                                                           )}
                                                                       </div>
                                                                       {translation.feedback.incorrectMessageApproved === false ? (
                                                                           <input
                                                                               type="text"
                                                                               value={translation.feedback.incorrectMessage}
                                                                               onChange={(e) => handleUpdateTranslationField(language, 'incorrectMessage', e.target.value)}
                                                                               className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none"
                                                                           />
                                                                       ) : (
                                                                           <p className="text-sm text-gray-700 dark:text-gray-300">{translation.feedback.incorrectMessage}</p>
                                                                       )}
                                                                   </div>

                                                                   {translation.feedback.hint && (
                                                                       <div className={`p-3 rounded-lg ${translation.feedback.hintApproved === false ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}>
                                                                           <div className="flex items-center justify-between mb-2">
                                                                               <label className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase">Hint</label>
                                                                               {translation.feedback.hintApproved === false ? (
                                                                                   <button
                                                                                       type="button"
                                                                                       onClick={() => handleApproveTranslationField(language, 'hint')}
                                                                                       className="bg-green-600 hover:bg-green-700 text-white text-[8px] px-2 py-1 rounded font-black uppercase flex items-center gap-1 transition-colors"
                                                                                   >
                                                                                       <Check className="w-3 h-3" /> APPROVE
                                                                                   </button>
                                                                               ) : (
                                                                                   <span className="text-[8px] text-green-600 dark:text-green-400 font-black flex items-center gap-1">
                                                                                       <CheckCircle className="w-3 h-3" /> APPROVED
                                                                                   </span>
                                                                               )}
                                                                           </div>
                                                                           {translation.feedback.hintApproved === false ? (
                                                                               <textarea
                                                                                   value={translation.feedback.hint}
                                                                                   onChange={(e) => handleUpdateTranslationField(language, 'hint', e.target.value)}
                                                                                   className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-orange-500 focus:outline-none resize-none"
                                                                                   rows={2}
                                                                               />
                                                                           ) : (
                                                                               <p className="text-sm text-gray-700 dark:text-gray-300">{translation.feedback.hint}</p>
                                                                           )}
                                                                       </div>
                                                                   )}
                                                               </div>
                                                           )}
                                                               </div>
                                                           </div>
                                                       )}
                                                   </div>
                                               );
                                           })}
                                       </div>
                                   </div>
                               )}

                               {/* Add New Translation */}
                               <div className="space-y-3">
                                   <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">ADD NEW LANGUAGE</label>
                                   <div className="flex gap-2">
                                       <select
                                           value={selectedTranslationLanguage}
                                           onChange={(e) => setSelectedTranslationLanguage(e.target.value)}
                                           disabled={isTranslating}
                                           className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
                                       >
                                           <option value="">Select a language...</option>
                                           {['English', 'Danish', 'German', 'Spanish', 'French', 'Swedish', 'Norwegian', 'Dutch', 'Belgian', 'Hebrew']
                                               .filter(lang => !editedPoint.task.translations?.[lang as any])
                                               .map(lang => (
                                                   <option key={lang} value={lang}>{getFlag(lang)} {lang}</option>
                                               ))
                                           }
                                       </select>

                                       <button
                                           type="button"
                                           onClick={() => handleAddTranslation(selectedTranslationLanguage)}
                                           disabled={!selectedTranslationLanguage || isTranslating}
                                           className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                       >
                                           {isTranslating ? (
                                               <>
                                                   <Loader2 className="w-4 h-4 animate-spin" />
                                                   TRANSLATING...
                                               </>
                                           ) : (
                                               <>
                                                   <Wand2 className="w-4 h-4" />
                                                   AI TRANSLATE
                                               </>
                                           )}
                                       </button>
                                   </div>
                                   <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                                       💡 AI will automatically translate all task content to the selected language. You can review and approve each field.
                                   </p>
                               </div>
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

               {/* Map Picker Modal */}
               {showMapPicker && (
                   <MeetingPointMapPicker
                       initialLat={editedPoint.location?.lat || 55.6761}
                       initialLng={editedPoint.location?.lng || 12.5683}
                       onLocationSelect={(lat, lng) => {
                           setEditedPoint({...editedPoint, location: { lat, lng }});
                           setShowMapPicker(false);
                       }}
                       onClose={() => setShowMapPicker(false)}
                   />
               )}

               {/* Color Scheme Editor Modal */}
               {showColorSchemeEditor && (
                   <ColorSchemeEditor
                       initialScheme={editedPoint.colorScheme}
                       onSave={(scheme) => {
                           setEditedPoint({ ...editedPoint, colorScheme: scheme });
                           setShowColorSchemeEditor(false);
                       }}
                       onClose={() => setShowColorSchemeEditor(false)}
                       title="Task Color Scheme (Local Override)"
                   />
               )}
           </form>
        )}
      </div>
    </div>
  );
};

export default TaskEditor;
