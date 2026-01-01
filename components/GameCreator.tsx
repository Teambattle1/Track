import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Game, TimerConfig, TimerMode, MapStyleId, Language, DesignConfig, GameTaskConfiguration, MapConfiguration } from '../types';
import {
    X, Gamepad2, Calendar, Building2, Upload, Search, Loader2, Clock, Hourglass,
    StopCircle, CheckCircle, Image as ImageIcon, Save, Edit, Map as MapIcon,
    Layers, Globe, Trash2, Bold, Italic, Underline, Link as LinkIcon, Info,
    Tag, MessageSquare, Flag, MapPin, Users, PenTool, LayoutGrid, BarChart2,
    Settings, Play, Target, List, Palette, EyeOff, Eye, ScrollText, Check, AlertTriangle,
    Snowflake, Mountain, ExternalLink, Code, PlayCircle, ChevronRight, Plus, Wand2
} from 'lucide-react';
import { searchLogoUrl, generateAiLogo } from '../services/ai';
import { uploadImage } from '../services/storage';
import { fetchUniqueTags, countMapStyleUsage, replaceMapStyleInGames, fetchCustomMapStyles, saveCustomMapStyle, deleteCustomMapStyle } from '../services/db';
import { resizeImage } from '../utils/image';
import GameLogViewer from './GameLogViewer';
import MeetingPointMapPicker from './MeetingPointMapPicker';
import GeminiApiKeyModal from './GeminiApiKeyModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePickerStyles.css';
import { formatDateTime, formatDateShort, formatTimeShort, getLocaleFromLanguage } from '../utils/date';

interface GameCreatorProps {
  onClose: () => void;
  onCreate: (game: Partial<Game>) => void;
  baseGame?: Game;
  onDelete?: (id: string) => void;
  onOpenPlaygroundEditor?: (playgroundId?: string) => void;
  initialGameMode?: 'standard' | 'playzone' | 'elimination' | null;
}

// Map Styles with working preview logic
// We use CSS classes to simulate the look for Historic/Winter to match the actual map implementation
const MAP_STYLES: { id: MapStyleId; label: string; preview: string; className?: string; icon?: React.ElementType }[] = [
    { id: 'none', label: 'No Map View', preview: '', icon: EyeOff },
    { id: 'google_custom', label: 'Snazzy & Custom', preview: '', icon: Settings },
    { id: 'osm', label: 'Standard', preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png' },
    { id: 'satellite', label: 'Satellite', preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/2722/4285' },
    { id: 'dark', label: 'Dark Mode', preview: 'https://a.basemaps.cartocdn.com/dark_all/13/4285/2722.png' },
    // Use OSM tile but apply CSS sepia filter in the UI to match the map behavior
    { id: 'historic', label: 'Historic', preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'sepia-[.7] contrast-125 brightness-90', icon: ScrollText },
    // Use OSM tile but apply CSS filter for Winter look
    { id: 'winter', label: 'Winter', preview: 'https://a.tile.openstreetmap.org/13/4285/2722.png', className: 'brightness-125 hue-rotate-180 saturate-50', icon: Snowflake },
    { id: 'ski', label: 'Ski Map', preview: 'https://tiles.openskimap.org/map/13/4285/2722.png', icon: Mountain },
    { id: 'norwegian', label: 'Norwegian', preview: 'https://tiles.openskimap.org/map/13/4285/2722.png', className: 'saturate-115 brightness-108', icon: Snowflake },
];

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
    { value: 'Danish', label: '🇩🇰 Danish' },
    { value: 'English', label: '🇬🇧 English' },
    { value: 'German', label: '🇩🇪 German' },
    { value: 'Spanish', label: '🇪🇸 Spanish' },
    { value: 'French', label: '🇫🇷 French' },
    { value: 'Swedish', label: '🇸🇪 Swedish' },
    { value: 'Norwegian', label: '🇳🇴 Norwegian' },
    { value: 'Dutch', label: '🇳🇱 Dutch' },
    { value: 'Belgian', label: '🇧🇪 Belgian' },
    { value: 'Hebrew', label: '🇮🇱 Hebrew' },
];

// 4x4 Grid - 16 Distinct Colors
const TAG_COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#d946ef', // Fuchsia
    '#f43f5e', // Rose
    '#64748b', // Slate
    '#71717a', // Zinc
    '#78350f', // Brown
    '#831843', // Dark Pink
    '#1e3a8a'  // Dark Blue
];

const RichTextEditor = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder?: string }) => {
  const handleCommand = (command: string, val?: string) => {
    document.execCommand(command, false, val || '');
  };

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-orange-500 transition-all bg-slate-800 flex flex-col h-full min-h-[150px]">
      <div className="flex items-center gap-1 p-2 bg-slate-900 border-b border-slate-700">
        <button type="button" onClick={() => handleCommand('bold')} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => handleCommand('italic')} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => handleCommand('underline')} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Underline className="w-3.5 h-3.5" /></button>
      </div>
      <div 
        className="p-3 outline-none text-sm text-slate-300 flex-1 overflow-y-auto"
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
        data-placeholder={placeholder}
      />
    </div>
  );
};

// Sidebar Tabs Configuration
const TABS = [
    { id: 'GAME', label: 'Game', icon: Gamepad2 },
    { id: 'TEAMS', label: 'Teams', icon: Users },
    { id: 'VOTE', label: 'Vote', icon: Users },
    { id: 'MAP', label: 'Mapstyle', icon: MapIcon },
    { id: 'TIMING', label: 'Timing', icon: Clock }, // New Timing Tab
    { id: 'PLAY', label: 'Play', icon: PlayCircle },
    { id: 'DESIGN', label: 'Game Setup', icon: PenTool },
    { id: 'TASKS', label: 'Tasks', icon: List },
    { id: 'PLAYGROUNDS', label: 'Zones', icon: LayoutGrid },
    { id: 'SETTINGS', label: 'Settings', icon: Settings },
    { id: 'LOGS', label: 'Logs', icon: ScrollText },
];

// Map Style Card Component with image loading state
interface MapStyleCardProps {
    style: { id: MapStyleId; label: string; preview: string; className?: string; icon?: React.ElementType };
    previewUrl: string;
    isCustom: boolean;
    Icon?: React.ElementType;
    isSelected: boolean;
    onSelect: () => void;
    onEditThumbnail: (e: React.MouseEvent) => void;
    onPreview: (e: React.MouseEvent) => void;
    usageCount?: number;
}

const MapStyleCard: React.FC<MapStyleCardProps> = ({
    style,
    previewUrl,
    isCustom,
    Icon,
    isSelected,
    onSelect,
    onEditThumbnail,
    onPreview,
    usageCount
}) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    return (
        <div className="relative group">
            <button
                onClick={onSelect}
                className={`relative w-full rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-slate-700 hover:border-white'}`}
            >
                {/* Usage Count Badge */}
                {usageCount !== undefined && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase z-10 shadow-lg">
                        {usageCount === 0 ? 'Not used' : `Used in ${usageCount} game${usageCount > 1 ? 's' : ''}`}
                    </div>
                )}

                <div className="aspect-square bg-slate-800 relative flex items-center justify-center">
                    {previewUrl && !imageError ? (
                        <>
                            {!imageLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
                                </div>
                            )}
                            <img
                                src={previewUrl}
                                alt={style.label}
                                className={`w-full h-full object-cover ${!isCustom && style.className ? style.className : ''} transition-opacity ${imageLoaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'}`}
                                onLoad={() => setImageLoaded(true)}
                                onError={() => {
                                    console.warn(`Failed to load map preview for ${style.id}:`, previewUrl);
                                    setImageError(true);
                                }}
                                loading="lazy"
                                crossOrigin="anonymous"
                            />
                        </>
                    ) : (
                        <div className="text-slate-500 group-hover:text-white transition-colors flex flex-col items-center gap-2">
                            {Icon ? <Icon className="w-10 h-10" /> : <MapIcon className="w-10 h-10" />}
                            {imageError && previewUrl && (
                                <span className="text-[8px] text-slate-600 uppercase font-bold">Preview unavailable</span>
                            )}
                        </div>
                    )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-center">
                    <span className="text-[10px] font-black uppercase text-white">{style.label}</span>
                </div>
                {isSelected && (
                    <div className="absolute top-2 right-2 bg-orange-600 text-white rounded-full p-1 shadow-lg">
                        <CheckCircle className="w-4 h-4" />
                    </div>
                )}
            </button>

            {/* Edit Thumbnail Button */}
            <button
                onClick={onEditThumbnail}
                className="absolute bottom-2 left-2 p-1.5 bg-slate-800/80 hover:bg-white text-white hover:text-black rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                title="Upload Custom Thumbnail"
            >
                <Edit className="w-3 h-3" />
            </button>

            {/* Preview Button - Bottom Bar */}
            {previewUrl && (
                <div className="mt-1">
                    <button
                        onClick={onPreview}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 text-[10px] font-black uppercase"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        PREVIEW
                    </button>
                </div>
            )}
        </div>
    );
};

const GameCreator: React.FC<GameCreatorProps> = ({ onClose, onCreate, baseGame, onDelete, onOpenPlaygroundEditor, initialGameMode = null }) => {
  const [activeTab, setActiveTab] = useState('GAME');
  const [gameMode, setGameMode] = useState<'standard' | 'playzone' | 'elimination'>(baseGame?.gameMode || initialGameMode || 'standard');

  // Core Info
  const [name, setName] = useState(baseGame?.name || '');
  const [description, setDescription] = useState(baseGame?.description || '');
  const [finishMessage, setFinishMessage] = useState(baseGame?.finishMessage || '');
  const [language, setLanguage] = useState<Language>(baseGame?.language || 'Danish');
  
  // Tags
  const [tags, setTags] = useState<string[]>(baseGame?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [selectedTagColor, setSelectedTagColor] = useState(TAG_COLORS[0]);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Client Info
  const [clientName, setClientName] = useState(baseGame?.client?.name || '');
  // Default to today's date when creating new game, or use existing date when editing
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [playingDate, setPlayingDate] = useState(baseGame?.client?.playingDate || getTodayDate());
  const [clientLogo, setClientLogo] = useState(baseGame?.client?.logoUrl || '');
  const [isSearchingLogo, setIsSearchingLogo] = useState(false);
  const [isGeneratingAiLogo, setIsGeneratingAiLogo] = useState(false);
  const [showGeminiKeyModal, setShowGeminiKeyModal] = useState(false);
  
  // Teams Config
  const [showOtherTeams, setShowOtherTeams] = useState(baseGame?.showOtherTeams || false);
  const [showRanking, setShowRanking] = useState(baseGame?.showRankingToPlayers || false);
  const [allowChatting, setAllowChatting] = useState(baseGame?.allowChatting ?? true);
  const [showPlayerLocations, setShowPlayerLocations] = useState(baseGame?.showPlayerLocations ?? true);
  const [showTaskDetails, setShowTaskDetails] = useState(baseGame?.showTaskDetailsToPlayers ?? true);

  // New Fields
  const [aboutTemplate, setAboutTemplate] = useState(baseGame?.aboutTemplate || '');
  const [instructorNotes, setInstructorNotes] = useState(baseGame?.instructorNotes || '');
  const [templateImages, setTemplateImages] = useState<string[]>(baseGame?.templateImageUrls || []);

  // End Location
  const [endLat, setEndLat] = useState<string>(baseGame?.endLocation?.lat?.toString?.() ?? '');
  const [endLng, setEndLng] = useState<string>(baseGame?.endLocation?.lng?.toString?.() ?? '');
  const [enableMeetingPoint, setEnableMeetingPoint] = useState<boolean>(baseGame?.enableMeetingPoint || false);

  // Design Config
  const [taskBackgroundImage, setTaskBackgroundImage] = useState<string>(baseGame?.designConfig?.taskBackgroundImage || '');
  const [primaryColor, setPrimaryColor] = useState<string>(baseGame?.designConfig?.primaryColor || '#3b82f6');
  const [useDefaultPrimary, setUseDefaultPrimary] = useState(!baseGame?.designConfig?.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState<string>(baseGame?.designConfig?.secondaryColor || '#ef4444');
  const [useDefaultSecondary, setUseDefaultSecondary] = useState(!baseGame?.designConfig?.secondaryColor);
  
  const [enableCodeScanner, setEnableCodeScanner] = useState(baseGame?.designConfig?.enableCodeScanner ?? true);
  const [enableGameTime, setEnableGameTime] = useState(baseGame?.designConfig?.enableGameTime ?? true);
  const [hideScore, setHideScore] = useState(baseGame?.designConfig?.hideScore || false);
  
  const [showScoreAfter, setShowScoreAfter] = useState(baseGame?.designConfig?.showScoreAfter || '');
  const [hideScoreAfter, setHideScoreAfter] = useState(baseGame?.designConfig?.hideScoreAfter || '');

  // Task Configuration
  const [timeLimitMode, setTimeLimitMode] = useState<'none' | 'global' | 'task_specific'>(baseGame?.taskConfig?.timeLimitMode || 'task_specific');
  const [globalTimeLimit, setGlobalTimeLimit] = useState<number>(baseGame?.taskConfig?.globalTimeLimit || 60);
  const [penaltyMode, setPenaltyMode] = useState<'zero' | 'negative'>(baseGame?.taskConfig?.penaltyMode || 'zero');
  const [showCorrectAnswerMode, setShowCorrectAnswerMode] = useState<'never' | 'always' | 'task_specific'>(baseGame?.taskConfig?.showCorrectAnswerMode || 'task_specific');
  const [limitHints, setLimitHints] = useState<boolean>(baseGame?.taskConfig?.limitHints || false);
  const [hintLimit, setHintLimit] = useState<number>(baseGame?.taskConfig?.hintLimit || 3);
  const [showAnswerCorrectnessMode, setShowAnswerCorrectnessMode] = useState<'never' | 'always' | 'task_specific'>(baseGame?.taskConfig?.showAnswerCorrectnessMode || 'task_specific');
  const [showAfterAnswerComment, setShowAfterAnswerComment] = useState<boolean>(baseGame?.taskConfig?.showAfterAnswerComment ?? true);
  const [teamVotingMode, setTeamVotingMode] = useState<'require_consensus' | 'captain_submit'>(baseGame?.taskConfig?.teamVotingMode || 'captain_submit');

  // Map Configuration (New)
  const [pinDisplayMode, setPinDisplayMode] = useState<'order' | 'score' | 'none'>(baseGame?.mapConfig?.pinDisplayMode || 'none');
  const [showShortIntroUnderPin, setShowShortIntroUnderPin] = useState<boolean>(baseGame?.mapConfig?.showShortIntroUnderPin ?? true);
  const [mapInteraction, setMapInteraction] = useState<'disable_click' | 'allow_all' | 'allow_specific'>(baseGame?.mapConfig?.mapInteraction || 'disable_click');
  const [hideMyLocation, setHideMyLocation] = useState<boolean>(baseGame?.mapConfig?.hideMyLocation || false);
  const [showMyTrack, setShowMyTrack] = useState<boolean>(baseGame?.mapConfig?.showMyTrack || false);
  const [allowNavigation, setAllowNavigation] = useState<boolean>(baseGame?.mapConfig?.allowNavigation || false);
  const [allowWeakGps, setAllowWeakGps] = useState<boolean>(baseGame?.mapConfig?.allowWeakGps || false);

  // Config
  const [timerMode, setTimerMode] = useState<TimerMode>(baseGame?.timerConfig?.mode || 'none');
  const [duration, setDuration] = useState<number>(baseGame?.timerConfig?.durationMinutes || 60);
  const [endDateTime, setEndDateTime] = useState<string>(baseGame?.timerConfig?.endTime || '');
  const [timerTitle, setTimerTitle] = useState(baseGame?.timerConfig?.title || 'TIME TO END');
  const [selectedMapStyle, setSelectedMapStyle] = useState<MapStyleId>(baseGame?.defaultMapStyle || 'osm');
  const [customMapJson, setCustomMapJson] = useState(baseGame?.googleMapStyleJson || '');
  const [showJsonHelp, setShowJsonHelp] = useState(false);
  const [jsonValidationStatus, setJsonValidationStatus] = useState<'IDLE' | 'VALID' | 'INVALID'>('IDLE');
  
  // Map Previews Override
  const [mapStylePreviews, setMapStylePreviews] = useState<Record<string, string>>({});
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  
  // UI State
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [isUploadingTaskBg, setIsUploadingTaskBg] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showMapStylePreview, setShowMapStylePreview] = useState(false);
  const [previewMapStyle, setPreviewMapStyle] = useState<MapStyleId | null>(null);
  const [previewCustomStyle, setPreviewCustomStyle] = useState<{id: string; name: string; json: string; previewUrl?: string} | null>(null);
  const [showSnazzyMapsBrowser, setShowSnazzyMapsBrowser] = useState(false);
  const [showCreateStyleModal, setShowCreateStyleModal] = useState(false);
  const [customStyleName, setCustomStyleName] = useState('');
  const [customStyles, setCustomStyles] = useState<Array<{id: string; name: string; json: string; previewUrl?: string}>>([]);
  const [editingCustomStyleId, setEditingCustomStyleId] = useState<string | null>(null);
  const [mapStyleUsage, setMapStyleUsage] = useState<Record<string, number>>({});
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const templateImgInputRef = useRef<HTMLInputElement>(null);
  const mapPreviewInputRef = useRef<HTMLInputElement>(null);
  const taskBgInputRef = useRef<HTMLInputElement>(null);
  const customStylePreviewInputRef = useRef<HTMLInputElement>(null);

  // Load Tag Colors & Fetch Unique Tags on mount
  useEffect(() => {
      const loadSettings = async () => {
          try {
              const stored = localStorage.getItem('geohunt_tag_colors');
              if (stored) setTagColors(JSON.parse(stored));

              // Load map previews (kept in localStorage for standard styles)
              const storedPreviews = localStorage.getItem('geohunt_map_previews');
              if (storedPreviews) setMapStylePreviews(JSON.parse(storedPreviews));

              // Load custom styles from Supabase
              const supabaseStyles = await fetchCustomMapStyles();
              setCustomStyles(supabaseStyles);
          } catch (e) {
              console.error("Failed to load settings", e);
          }

          fetchUniqueTags().then(tags => setExistingTags(tags));
      };

      loadSettings();
  }, []);

  // Load map style usage counts
  useEffect(() => {
      const loadUsageCounts = async () => {
          setIsLoadingUsage(true);
          const usage: Record<string, number> = {};

          // Count usage for all standard map styles
          for (const style of MAP_STYLES) {
              const count = await countMapStyleUsage(style.id);
              usage[style.id] = count;
          }

          // Count usage for custom styles (they all use 'google_custom' as the ID)
          const googleCustomCount = await countMapStyleUsage('google_custom');
          usage['google_custom'] = googleCustomCount;

          setMapStyleUsage(usage);
          setIsLoadingUsage(false);
      };

      loadUsageCounts();
  }, [customStyles]);

  const saveTagColors = (newColors: Record<string, string>) => {
      setTagColors(newColors);
      localStorage.setItem('geohunt_tag_colors', JSON.stringify(newColors));
  };

  const handleMapPreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && editingStyleId) {
          const url = await uploadImage(file);
          if (url) {
              const updated = { ...mapStylePreviews, [editingStyleId]: url };
              setMapStylePreviews(updated);
              localStorage.setItem('geohunt_map_previews', JSON.stringify(updated));
          }
      }
      setEditingStyleId(null);
      if (mapPreviewInputRef.current) mapPreviewInputRef.current.value = '';
  };

  const handleCustomStylePreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && editingCustomStyleId) {
          const url = await uploadImage(file);
          if (url) {
              const styleToUpdate = customStyles.find(s => s.id === editingCustomStyleId);
              if (styleToUpdate) {
                  const updatedStyle = { ...styleToUpdate, previewUrl: url };
                  // Save to Supabase
                  const savedStyle = await saveCustomMapStyle(updatedStyle);
                  if (savedStyle) {
                      const updatedStyles = customStyles.map(style =>
                          style.id === editingCustomStyleId ? savedStyle : style
                      );
                      setCustomStyles(updatedStyles);
                  }
              }
          }
      }
      setEditingCustomStyleId(null);
      if (customStylePreviewInputRef.current) customStylePreviewInputRef.current.value = '';
  };

  const handleLogoSearch = async () => {
      if (!clientName.trim()) return;
      setIsSearchingLogo(true);
      const url = await searchLogoUrl(clientName);
      if (url) {
          setClientLogo(url);
      } else {
          alert("No logo found for this name. Try uploading one.");
      }
      setIsSearchingLogo(false);
  };

  const handleLogoError = () => {
      // If Clearbit fails, try fallback to Google favicon
      if (clientLogo && clientLogo.includes('clearbit')) {
          const domain = clientLogo.split('/').pop();
          const fallbackUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          console.log('[Logo] Clearbit failed, trying Google favicon:', fallbackUrl);
          setClientLogo(fallbackUrl);
      }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploadingLogo(true);
          const url = await uploadImage(file);
          if (url) setClientLogo(url);
          setIsUploadingLogo(false);
      }
  };

  const handleGenerateAiLogo = async () => {
      if (!clientName.trim()) return;
      setIsGeneratingAiLogo(true);
      try {
          const url = await generateAiLogo(clientName, 'professional');
          if (url) {
              setClientLogo(url);
          } else {
              alert("Failed to generate logo. Please try again or upload one manually.");
          }
      } catch (error: any) {
          // Check if it's an API key error
          if (error?.message?.includes('API Key missing')) {
              setShowGeminiKeyModal(true);
          } else {
              console.error('Error generating logo:', error);
              alert("Failed to generate logo. Please try again or upload one manually.");
          }
      } finally {
          setIsGeneratingAiLogo(false);
      }
  };

  const handleTaskBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploadingTaskBg(true);
          try {
              // 1. Resize client side to max 1200px
              const resizedBase64 = await resizeImage(file, 1200);
              // 2. Upload the resized image
              const url = await uploadImage(resizedBase64);
              if (url) setTaskBackgroundImage(url);
          } catch(e) {
              console.error("Failed to resize/upload", e);
          }
          setIsUploadingTaskBg(false);
      }
  };

  const handleTemplateImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          setIsUploadingTemplate(true);
          for (let i = 0; i < files.length; i++) {
              const url = await uploadImage(files[i]);
              if (url) {
                  setTemplateImages(prev => [...prev, url]);
              }
          }
          setIsUploadingTemplate(false);
      }
  };

  const removeTemplateImage = (idx: number) => {
      setTemplateImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleTagInputChange = (val: string) => {
      setTagInput(val);
      if (val.trim()) {
          const matches = existingTags.filter(t => t.toLowerCase().includes(val.toLowerCase()) && !tags.includes(t));
          setFilteredSuggestions(matches.slice(0, 5)); // Limit to 5 suggestions
          setShowSuggestions(true);
      } else {
          setShowSuggestions(false);
      }
  };

  const handleAddTag = (tagToAdd: string = tagInput) => {
      const val = tagToAdd.trim();
      if (val) {
          if (!tags.includes(val)) {
              setTags([...tags, val]);
              // Save color preference for this tag
              saveTagColors({ ...tagColors, [val]: selectedTagColor });
          }
          setTagInput('');
          setShowSuggestions(false);
      }
  };

  const handleRemoveTag = (tag: string) => {
      setTags(tags.filter(t => t !== tag));
  };

  const cycleTagColor = (tag: string) => {
      const currentColor = tagColors[tag] || TAG_COLORS[0];
      const idx = TAG_COLORS.indexOf(currentColor);
      const nextColor = TAG_COLORS[(idx + 1) % TAG_COLORS.length];
      saveTagColors({ ...tagColors, [tag]: nextColor });
  };

  const validateJson = () => {
      try {
          if (!customMapJson.trim()) {
              setJsonValidationStatus('IDLE');
              return;
          }
          const parsed = JSON.parse(customMapJson);
          if (Array.isArray(parsed)) {
              setJsonValidationStatus('VALID');
              // Apply the custom map style
              setSelectedMapStyle('google_custom');
              // Keep the validation status as VALID (don't reset)
          } else {
              setJsonValidationStatus('INVALID');
          }
      } catch (e) {
          setJsonValidationStatus('INVALID');
      }
  };

  const handleCreateCustomStyle = async () => {
      if (!customStyleName.trim()) {
          alert('Please enter a name for your custom style');
          return;
      }

      if (!customMapJson.trim()) {
          alert('Please add custom map JSON first');
          return;
      }

      try {
          // Validate JSON
          const parsed = JSON.parse(customMapJson);
          if (!Array.isArray(parsed)) {
              alert('Invalid JSON format');
              return;
          }

          // Create new custom style (without ID, will be generated by Supabase)
          const newStyle = {
              name: customStyleName.trim(),
              json: customMapJson
          };

          // Save to Supabase
          const savedStyle = await saveCustomMapStyle(newStyle);

          if (savedStyle) {
              // Add to custom styles in state
              const updatedStyles = [...customStyles, savedStyle];
              setCustomStyles(updatedStyles);

              // Close modal and reset
              setShowCreateStyleModal(false);
              setCustomStyleName('');
              // Clear the JSON box
              setCustomMapJson('');
              setJsonValidationStatus('IDLE');

              // Show success
              alert(`Custom style "${savedStyle.name}" added to library!`);
          } else {
              alert('Failed to save custom style to database. Please try again.');
          }
      } catch (e) {
          alert('Failed to create custom style. Please check your JSON format.');
      }
  };

  const handleDeleteCustomStyle = async (styleId: string) => {
      const style = customStyles.find(s => s.id === styleId);
      if (!style) return;

      // Check if google_custom is in use (all custom styles use this ID)
      const usageCount = mapStyleUsage['google_custom'] || 0;

      let confirmMessage = `Delete custom style "${style.name}"?`;
      if (usageCount > 0) {
          confirmMessage = `This style is currently used in ${usageCount} game${usageCount > 1 ? 's' : ''}.\n\nDeleting it will replace it with "Standard" map style in all affected games.\n\nContinue?`;
      }

      if (!confirm(confirmMessage)) return;

      // If in use, replace with standard in all games
      if (usageCount > 0) {
          const replaced = await replaceMapStyleInGames('google_custom', 'osm');
          if (replaced > 0) {
              alert(`Replaced custom map style with "Standard" in ${replaced} game${replaced > 1 ? 's' : ''}.`);
              // Reload usage counts
              const newUsage = { ...mapStyleUsage, 'google_custom': 0 };
              setMapStyleUsage(newUsage);
          }
      }

      // Delete from Supabase
      const deleted = await deleteCustomMapStyle(styleId);

      if (deleted) {
          // Remove from custom styles in state
          const updatedStyles = customStyles.filter(s => s.id !== styleId);
          setCustomStyles(updatedStyles);
      } else {
          alert('Failed to delete custom style from database. Please try again.');
      }
  };

  const handleCreate = () => {
      if (!name.trim()) {
          alert("Game Name is required");
          return;
      }

      // --- VALIDATION ---
      if (timerMode === 'countdown') {
          if (!Number.isFinite(duration) || duration <= 0) {
              alert('Please enter a valid countdown duration (minutes).');
              return;
          }
      }

      if (timeLimitMode === 'global') {
          if (!Number.isFinite(globalTimeLimit) || globalTimeLimit <= 0) {
              alert('Please enter a valid global time limit (seconds).');
              return;
          }
      }

      if (limitHints) {
          if (!Number.isFinite(hintLimit) || hintLimit <= 0) {
              alert('Please enter a valid hint limit.');
              return;
          }
      }

      if (selectedMapStyle === 'google_custom') {
          try {
              const parsed = JSON.parse(customMapJson);
              if (!Array.isArray(parsed)) {
                  alert('Custom Google Map Style JSON must be a JSON array.');
                  return;
              }
          } catch {
              alert('Invalid JSON for Custom Google Map Style.');
              return;
          }
      }

      // Validate Game Modes
      if (gameMode === 'playzone') {
          // Note: Full playground validation will occur when game is saved with tasks
          // This check ensures user is aware of playzone requirements
          console.log('✓ Playzone game mode selected. Remember to add playgrounds and tasks.');
      }

      if (gameMode === 'elimination') {
          // Elimination games require GPS support and will feature team colors and bomb system
          console.log('✓ Elimination game mode selected. Teams will compete to capture tasks first.');
      }

      let endLocation = undefined;
      if (endLat && endLng) {
          const lat = parseFloat(endLat);
          const lng = parseFloat(endLng);
          if (!isNaN(lat) && !isNaN(lng)) {
              if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                  alert('End location coordinates are out of range.');
                  return;
              }
              endLocation = { lat, lng };
          }
      }

      const designConfig: DesignConfig = {
          taskBackgroundImage: taskBackgroundImage || undefined,
          primaryColor: useDefaultPrimary ? undefined : primaryColor,
          secondaryColor: useDefaultSecondary ? undefined : secondaryColor,
          enableCodeScanner,
          enableGameTime,
          hideScore,
          showScoreAfter: showScoreAfter || undefined,
          hideScoreAfter: hideScoreAfter || undefined
      };

      const taskConfig: GameTaskConfiguration = {
          timeLimitMode,
          globalTimeLimit,
          penaltyMode,
          showCorrectAnswerMode,
          limitHints,
          hintLimit,
          showAnswerCorrectnessMode,
          showAfterAnswerComment,
          teamVotingMode
      };

      const mapConfig: MapConfiguration = {
          pinDisplayMode,
          showShortIntroUnderPin,
          mapInteraction,
          hideMyLocation,
          showMyTrack,
          allowNavigation,
          allowWeakGps
      };

      const newGameData: Partial<Game> = {
          name,
          description,
          finishMessage,
          language,
          gameMode,
          defaultMapStyle: selectedMapStyle,
          googleMapStyleJson: selectedMapStyle === 'google_custom' ? customMapJson : undefined,
          aboutTemplate,
          instructorNotes,
          templateImageUrls: templateImages,
          tags,
          endLocation,
          enableMeetingPoint,
          showOtherTeams,
          showRankingToPlayers: showRanking,
          allowChatting,
          showPlayerLocations,
          showTaskDetailsToPlayers: showTaskDetails,
          designConfig,
          taskConfig,
          mapConfig,
          client: {
              name: clientName,
              logoUrl: clientLogo,
              playingDate: playingDate
          },
          timerConfig: {
              mode: timerMode,
              durationMinutes: timerMode === 'countdown' ? duration : undefined,
              endTime: timerMode === 'scheduled_end' ? endDateTime : undefined,
              title: timerTitle
          }
      };

      if (baseGame) {
          newGameData.id = baseGame.id;
      }

      onCreate(newGameData);
  };

  const handleDeleteClick = () => {
      if (deleteConfirm) {
          if (baseGame && onDelete) {
              onDelete(baseGame.id);
              onClose();
          }
      } else {
          setDeleteConfirm(true);
          setTimeout(() => setDeleteConfirm(false), 3000);
      }
  };

  const isEditMode = !!baseGame;

  // --- Helper Components for Task Config ---
  const RadioOption = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
      <div 
          onClick={onClick}
          className="flex items-center gap-3 cursor-pointer group"
      >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-white' : 'border-slate-600 group-hover:border-slate-500'}`}>
              {selected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
          </div>
          <span className={`text-xs ${selected ? 'text-white font-bold' : 'text-slate-400 group-hover:text-slate-300'}`}>{label}</span>
      </div>
  );

  const CheckboxOption = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (val: boolean) => void }) => (
      <label className="flex items-center gap-3 cursor-pointer group">
          <input 
              type="checkbox" 
              checked={checked} 
              onChange={(e) => onChange(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600"
          />
          <span className={`text-xs ${checked ? 'text-slate-200' : 'text-slate-400 group-hover:text-slate-300'}`}>{label}</span>
      </label>
  );

  const renderContent = () => {
      // Prevent MAP tab for playzone mode only (elimination is GPS-based and needs map style selection)
      const effectiveTab = gameMode === 'playzone' && activeTab === 'MAP' ? 'GAME' : activeTab;

      switch (effectiveTab) {
          // ... (Existing Cases) ...
          case 'GAME':
              return (
                  <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-2">
                      {/* 0. Game Mode Selection */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-4">Game Mode</label>
                          <div className="flex gap-4">
                              <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all" style={{ borderColor: gameMode === 'standard' ? '#f97316' : '#475569', backgroundColor: gameMode === 'standard' ? '#7c2d12' : '#1e293b' }}>
                                  <input
                                      type="radio"
                                      name="gameMode"
                                      value="standard"
                                      checked={gameMode === 'standard'}
                                      onChange={(e) => setGameMode(e.target.value as 'standard' | 'playzone' | 'elimination')}
                                      className="w-4 h-4"
                                  />
                                  <div>
                                      <span className="font-bold text-white block">STANDARD GAME</span>
                                      <span className="text-[10px] text-slate-400">GPS-based navigation & map</span>
                                  </div>
                              </label>
                              <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all" style={{ borderColor: gameMode === 'playzone' ? '#14b8a6' : '#475569', backgroundColor: gameMode === 'playzone' ? '#134e4a' : '#1e293b' }}>
                                  <input
                                      type="radio"
                                      name="gameMode"
                                      value="playzone"
                                      checked={gameMode === 'playzone'}
                                      onChange={(e) => setGameMode(e.target.value as 'standard' | 'playzone' | 'elimination')}
                                      className="w-4 h-4"
                                  />
                                  <div>
                                      <span className="font-bold text-white block">PLAYZONE GAME</span>
                                      <span className="text-[10px] text-slate-400">Indoor, touch-based on playground</span>
                                  </div>
                              </label>
                              <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all" style={{ borderColor: gameMode === 'elimination' ? '#ef4444' : '#475569', backgroundColor: gameMode === 'elimination' ? '#7f1d1d' : '#1e293b' }}>
                                  <input
                                      type="radio"
                                      name="gameMode"
                                      value="elimination"
                                      checked={gameMode === 'elimination'}
                                      onChange={(e) => setGameMode(e.target.value as 'standard' | 'playzone' | 'elimination')}
                                      className="w-4 h-4"
                                  />
                                  <div>
                                      <span className="font-bold text-white block">ELIMINATION GAME</span>
                                      <span className="text-[10px] text-slate-400">GPS-based competitive CTF with bombs</span>
                                  </div>
                              </label>
                          </div>
                      </div>

                      {/* 1. Name & Date */}
                      <div className="grid grid-cols-3 gap-6">
                          <div className="col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Game Name</label>
                              <input
                                  type="text"
                                  value={name}
                                  onChange={(e) => setName(e.target.value.toUpperCase())}
                                  placeholder="e.g. CITY EXPLORER 2025"
                                  className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none transition-colors text-lg uppercase"
                              />
                          </div>
                          <div className="col-span-1 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Playing Date</label>
                              <div className="relative h-14">
                                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                  <input 
                                      type="date" 
                                      value={playingDate}
                                      onChange={(e) => setPlayingDate(e.target.value)}
                                      className="w-full h-full pl-10 p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none uppercase"
                                  />
                              </div>
                          </div>
                      </div>

                      {/* 2. Client & Logo */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-4">Client / Event Configuration</label>
                          <div className="flex gap-4">
                              <div className="flex-1 space-y-4">
                                  <div className="relative">
                                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                      <input
                                          type="text"
                                          value={clientName}
                                          onChange={(e) => setClientName(e.target.value.toUpperCase())}
                                          placeholder="CLIENT NAME (E.G. ACME CORP)"
                                          className="w-full pl-10 p-4 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none uppercase"
                                      />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                      <div className="flex gap-2">
                                          <button
                                              onClick={handleLogoSearch}
                                              disabled={!clientName || isSearchingLogo}
                                              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[10px] font-bold uppercase text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                              {isSearchingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                              AUTO-SEARCH LOGO
                                          </button>
                                          <button
                                              onClick={() => logoInputRef.current?.click()}
                                              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[10px] font-bold uppercase text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2"
                                          >
                                              <Upload className="w-3 h-3" /> UPLOAD LOGO
                                          </button>
                                      </div>
                                      {!clientLogo && (
                                          <button
                                              onClick={handleGenerateAiLogo}
                                              disabled={!clientName || isGeneratingAiLogo}
                                              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 border border-purple-500 rounded-xl text-[10px] font-bold uppercase text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                              {isGeneratingAiLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                              AI GENERATE LOGO
                                          </button>
                                      )}
                                  </div>
                              </div>

                              <div className="w-32 h-32 bg-slate-950 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center relative overflow-hidden shrink-0">
                                  {isUploadingLogo ? (
                                      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                  ) : clientLogo ? (
                                      <div className="relative w-full h-full p-2 flex items-center justify-center">
                                          <img
                                              src={clientLogo}
                                              onError={handleLogoError}
                                              className="max-w-full max-h-full object-contain"
                                          />
                                          <button 
                                              onClick={() => setClientLogo('')}
                                              className="absolute top-1 right-1 p-1 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors"
                                          >
                                              <X className="w-3 h-3" />
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="text-center text-slate-600">
                                          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                                          <span className="text-[8px] font-bold uppercase">NO LOGO</span>
                                      </div>
                                  )}
                                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                              </div>
                          </div>
                      </div>

                      {/* 3. Language & Tags (Redesigned: Input -> Color Grid -> Tags List) */}
                      <div className="grid grid-cols-2 gap-6">
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Language</label>
                              <div className="relative">
                                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                  <select 
                                      value={language}
                                      onChange={(e) => setLanguage(e.target.value as Language)}
                                      className="w-full pl-10 p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none uppercase appearance-none"
                                  >
                                      {LANGUAGE_OPTIONS.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Tags</label>
                              
                              <div className="flex items-start gap-4 mb-4">
                                  {/* 1. Auto-complete Input */}
                                  <div className="relative flex-1">
                                      <input
                                          type="text"
                                          value={tagInput}
                                          onChange={(e) => handleTagInputChange(e.target.value.toUpperCase())}
                                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                          onFocus={() => tagInput && setShowSuggestions(true)}
                                          placeholder="ADD TAG..."
                                          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-blue-500 h-[48px] uppercase"
                                      />
                                      {showSuggestions && filteredSuggestions.length > 0 && (
                                          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-1">
                                              {filteredSuggestions.map((suggestion, idx) => (
                                                  <button
                                                      key={idx}
                                                      onClick={() => handleAddTag(suggestion)}
                                                      className="w-full text-left px-4 py-2 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white uppercase"
                                                  >
                                                      {suggestion}
                                                  </button>
                                              ))}
                                          </div>
                                      )}
                                  </div>

                                  <button onClick={() => handleAddTag()} className="h-[48px] w-[48px] bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center shrink-0">
                                      <Tag className="w-5 h-5" />
                                  </button>
                              </div>

                              {/* 2. Color Grid (4x4) */}
                              <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 grid grid-cols-8 gap-2 w-full shrink-0 mb-4">
                                  {TAG_COLORS.map(c => (
                                      <button
                                          key={c}
                                          onClick={() => setSelectedTagColor(c)}
                                          className={`w-6 h-6 rounded-full border-2 transition-all mx-auto ${selectedTagColor === c ? 'border-white scale-125 shadow-lg ring-2 ring-white/20' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-110'}`}
                                          style={{ backgroundColor: c }}
                                          title={c}
                                      />
                                  ))}
                              </div>

                              {/* 3. Selected Chips (Tags Made) */}
                              <div className="flex flex-wrap gap-2 min-h-[32px]">
                                  {tags.length === 0 && <span className="text-xs text-slate-600 italic">No tags added yet.</span>}
                                  {tags.map((tag, index) => {
                                      const color = tagColors[tag] || TAG_COLORS[0];
                                      return (
                                          <span
                                            key={`${tag}-${index}`}
                                            onClick={() => cycleTagColor(tag)}
                                            className="text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity select-none shadow-sm"
                                            style={{ backgroundColor: color }}
                                            title="Click to cycle color"
                                          >
                                              {tag}
                                              <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} 
                                                className="hover:text-black/50"
                                              >
                                                  <X className="w-3 h-3" />
                                              </button>
                                          </span>
                                      );
                                  })}
                              </div>
                          </div>
                      </div>
                  </div>
              );
          case 'TIMING': // NEW TAB
              return (
                  <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-4">Timing Configuration</label>
                          <div className="grid grid-cols-3 gap-2 mb-6">
                              <button onClick={() => setTimerMode('none')} className={`p-4 rounded-xl border-2 transition-all text-xs font-black uppercase ${timerMode === 'none' ? 'bg-slate-800 border-white text-white' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>NO TIMER</button>
                              <button onClick={() => setTimerMode('countdown')} className={`p-4 rounded-xl border-2 transition-all text-xs font-black uppercase ${timerMode === 'countdown' ? 'bg-orange-900/20 border-orange-500 text-orange-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>COUNTDOWN</button>
                              <button onClick={() => setTimerMode('scheduled_end')} className={`p-4 rounded-xl border-2 transition-all text-xs font-black uppercase ${timerMode === 'scheduled_end' ? 'bg-red-900/20 border-red-500 text-red-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>END TIME</button>
                          </div>

                          {timerMode === 'countdown' && (
                              <div className="space-y-4 animate-in fade-in">
                                  <div>
                                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Duration (Minutes)</label>
                                      <input type="number" value={duration} onChange={(e) => {
                                          const v = parseInt(e.target.value, 10);
                                          setDuration(Number.isFinite(v) ? v : 0);
                                      }} className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none uppercase" />
                                  </div>
                                  <div>
                                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Timer Title</label>
                                      <input type="text" value={timerTitle} onChange={(e) => setTimerTitle(e.target.value.toUpperCase())} className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-orange-500 outline-none uppercase" />
                                  </div>
                              </div>
                          )}

                          {timerMode === 'scheduled_end' && (
                              <div className="space-y-4 animate-in fade-in">
                                  <div>
                                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ends At (Local Time)</label>
                                      <button
                                          onClick={() => setShowDateTimePicker(true)}
                                          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold hover:border-red-500 transition-colors text-left flex items-center justify-between group"
                                      >
                                          <span className={endDateTime ? 'text-white' : 'text-slate-500'}>
                                              {endDateTime ? formatDateTime(endDateTime, language, {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  hour12: false
                                              }) : 'Click to select date & time'}
                                          </span>
                                          <Calendar className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                                      </button>
                                  </div>
                                  <div>
                                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Timer Title</label>
                                      <input type="text" value={timerTitle} onChange={(e) => setTimerTitle(e.target.value.toUpperCase())} className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold focus:border-red-500 outline-none uppercase" />
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              );
          case 'MAP':
              return (
                  <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-2 space-y-6">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-4">Select Visual Style</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {MAP_STYLES.map(style => {
                                  const Icon = style.icon;
                                  const customPreview = mapStylePreviews[style.id];
                                  const previewUrl = customPreview || style.preview;
                                  const isCustom = !!customPreview;

                                  return (
                                      <MapStyleCard
                                          key={style.id}
                                          style={style}
                                          previewUrl={previewUrl}
                                          isCustom={isCustom}
                                          Icon={Icon}
                                          isSelected={selectedMapStyle === style.id}
                                          usageCount={mapStyleUsage[style.id]}
                                          onSelect={() => {
                                              setSelectedMapStyle(style.id);
                                              setShowMapStylePreview(false);
                                          }}
                                          onEditThumbnail={(e) => {
                                              e.stopPropagation();
                                              setEditingStyleId(style.id);
                                              mapPreviewInputRef.current?.click();
                                          }}
                                          onPreview={(e) => {
                                              e.stopPropagation();
                                              setPreviewMapStyle(style.id);
                                              setPreviewCustomStyle(null);
                                              setShowMapStylePreview(true);
                                          }}
                                      />
                                  );
                              })}

                              {/* Custom Saved Styles */}
                              {customStyles.map(customStyle => {
                                  return (
                                      <div key={customStyle.id} className="relative group">
                                          <button
                                              onClick={() => {
                                                  setSelectedMapStyle('google_custom');
                                                  setCustomMapJson(customStyle.json);
                                                  setJsonValidationStatus('VALID');
                                                  setShowMapStylePreview(false);
                                              }}
                                              className={`relative w-full rounded-xl overflow-hidden border-2 transition-all ${selectedMapStyle === 'google_custom' && customMapJson === customStyle.json ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-slate-700 hover:border-white'}`}
                                          >
                                              {/* Usage Count Badge for Custom Styles */}
                                              {mapStyleUsage['google_custom'] !== undefined && (
                                                  <div className="absolute top-2 left-2 bg-purple-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase z-10 shadow-lg">
                                                      {mapStyleUsage['google_custom'] === 0 ? 'Not used' : `Used in ${mapStyleUsage['google_custom']} game${mapStyleUsage['google_custom'] > 1 ? 's' : ''}`}
                                                  </div>
                                              )}

                                              <div className="aspect-square bg-gradient-to-br from-purple-900 to-blue-900 relative flex items-center justify-center">
                                                  {customStyle.previewUrl ? (
                                                      <img
                                                          src={customStyle.previewUrl}
                                                          alt={customStyle.name}
                                                          className="w-full h-full object-cover"
                                                          crossOrigin="anonymous"
                                                      />
                                                  ) : (
                                                      <Settings className="w-10 h-10 text-purple-300" />
                                                  )}
                                              </div>
                                              <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-center">
                                                  <span className="text-[10px] font-black uppercase text-white">{customStyle.name}</span>
                                              </div>
                                              {selectedMapStyle === 'google_custom' && customMapJson === customStyle.json && (
                                                  <div className="absolute top-2 right-2 bg-orange-600 text-white rounded-full p-1 shadow-lg">
                                                      <CheckCircle className="w-4 h-4" />
                                                  </div>
                                              )}
                                          </button>

                                          {/* Upload Thumbnail Button */}
                                          <button
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingCustomStyleId(customStyle.id);
                                                  customStylePreviewInputRef.current?.click();
                                              }}
                                              className="absolute bottom-2 right-2 p-1.5 bg-slate-800/80 hover:bg-white text-white hover:text-black rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                                              title="Upload Thumbnail"
                                          >
                                              <Edit className="w-3 h-3" />
                                          </button>

                                          {/* Delete Button */}
                                          <button
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteCustomStyle(customStyle.id);
                                              }}
                                              className="absolute bottom-2 left-2 p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                                              title="Delete Custom Style"
                                          >
                                              <Trash2 className="w-3 h-3" />
                                          </button>

                                          {/* Preview Button */}
                                          {customStyle.previewUrl && (
                                              <div className="mt-1">
                                                  <button
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          setPreviewCustomStyle(customStyle);
                                                          setPreviewMapStyle(null);
                                                          setShowMapStylePreview(true);
                                                      }}
                                                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 text-[10px] font-black uppercase"
                                                  >
                                                      <Eye className="w-3.5 h-3.5" />
                                                      PREVIEW
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>

                          <input ref={mapPreviewInputRef} type="file" accept="image/*" className="hidden" onChange={handleMapPreviewUpload} />
                          <input ref={customStylePreviewInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomStylePreviewUpload} />

                          {selectedMapStyle === 'google_custom' && (
                              <div className="mt-6 bg-slate-950 border border-slate-700 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 relative">
                                  <div className="flex justify-between items-start mb-2">
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase">Snazzy Maps / Custom Style JSON</label>
                                      <button
                                          onClick={() => setShowJsonHelp(true)}
                                          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase flex items-center gap-1"
                                      >
                                          <Info className="w-3 h-3" /> HOW TO GET JSON?
                                      </button>
                                  </div>

                                  {jsonValidationStatus === 'VALID' && customMapJson.trim() && (
                                      <div className="mb-3 bg-green-900/30 border border-green-600 rounded-lg p-3 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                          <Check className="w-4 h-4 text-green-400" />
                                          <span className="text-xs font-bold text-green-300 uppercase">Custom map style applied! This style will be used in your game.</span>
                                      </div>
                                  )}

                                  <textarea
                                      value={customMapJson}
                                      onChange={(e) => { setCustomMapJson(e.target.value); setJsonValidationStatus('IDLE'); }}
                                      placeholder='Paste JSON array here (e.g. [{"featureType": "all", ...}])'
                                      className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 outline-none focus:border-orange-500 custom-scrollbar resize-none mb-2"
                                  />
                                  
                                  <div className="flex justify-between items-center gap-2">
                                      <a
                                          href="https://snazzymaps.com/"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] font-bold text-slate-500 hover:text-white uppercase flex items-center gap-1 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg transition-colors"
                                      >
                                          <ExternalLink className="w-3 h-3" /> OPEN SNAZZY MAPS
                                      </a>

                                      <div className="flex gap-2">
                                          <button
                                              onClick={validateJson}
                                              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${jsonValidationStatus === 'VALID' ? 'bg-green-600 text-white' : (jsonValidationStatus === 'INVALID' ? 'bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white')}`}
                                          >
                                              {jsonValidationStatus === 'VALID' ? <Check className="w-3 h-3" /> : (jsonValidationStatus === 'INVALID' ? <AlertTriangle className="w-3 h-3" /> : <Code className="w-3 h-3" />)}
                                              {jsonValidationStatus === 'VALID' ? '✓ APPLIED' : (jsonValidationStatus === 'INVALID' ? 'INVALID JSON' : 'VALIDATE & APPLY')}
                                          </button>

                                          {jsonValidationStatus === 'VALID' && customMapJson.trim() && (
                                              <button
                                                  onClick={() => setShowCreateStyleModal(true)}
                                                  className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white border-2 border-orange-500"
                                              >
                                                  <Plus className="w-3 h-3" /> CREATE STYLE
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>

                  </div>
              );
          case 'PLAY': // NEW TAB
              return (
                  <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2">
                      {/* Intro Message */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col min-h-[300px]">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" /> Intro Message
                          </label>
                          <RichTextEditor 
                              value={description}
                              onChange={setDescription}
                              placeholder="Briefing shown to players upon entering the game..."
                          />
                      </div>

                      {/* Finish Message */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col min-h-[300px]">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Flag className="w-4 h-4" /> Finish Message
                          </label>
                          <RichTextEditor 
                              value={finishMessage} 
                              onChange={setFinishMessage} 
                              placeholder="Message shown when game ends..."
                          />
                      </div>

                      {/* Meeting Point Section - Only for GPS-based games */}
                      {gameMode !== 'playzone' && (
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <div className="flex items-center gap-2 mb-4">
                                  <label className="text-[10px] font-bold text-white uppercase">Meeting Point</label>
                                  <Info className="w-3 h-3 text-slate-500" />
                              </div>

                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                  <label className="block text-[10px] font-bold text-white uppercase mb-4">Meeting point</label>

                                  <div className="flex items-center gap-3 mb-6">
                                      <input
                                          type="checkbox"
                                          checked={enableMeetingPoint}
                                          onChange={(e) => setEnableMeetingPoint(e.target.checked)}
                                          className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-slate-300">Enable meeting point after finishing the game</span>
                                  </div>

                                  {enableMeetingPoint && (
                                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                          <button
                                              onClick={() => setShowMapPicker(true)}
                                              className="w-full p-4 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl font-bold uppercase text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 group"
                                          >
                                              <MapPin className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                              PICK LOCATION ON MAP
                                          </button>
                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Latitude</label>
                                                  <input
                                                      type="text"
                                                      value={endLat}
                                                      onChange={(e) => setEndLat(e.target.value)}
                                                      placeholder="55.6761"
                                                      className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-orange-500 outline-none uppercase"
                                                  />
                                              </div>
                                              <div>
                                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Longitude</label>
                                                  <input
                                                      type="text"
                                                      value={endLng}
                                                      onChange={(e) => setEndLng(e.target.value)}
                                                      placeholder="12.5683"
                                                      className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-orange-500 outline-none uppercase"
                                                  />
                                              </div>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              );
          case 'DESIGN': // GAME SETUP TAB
              return (
                  <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2">
                      {/* Visibility & Scoring */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-white uppercase mb-4">Visibility of app design elements</label>
                          <div className="space-y-3 mb-6">
                              <label className="flex items-center gap-3 cursor-pointer">
                                  <input 
                                      type="checkbox" 
                                      checked={enableCodeScanner} 
                                      onChange={(e) => setEnableCodeScanner(e.target.checked)}
                                      className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600"
                                  />
                                  <span className="text-xs text-slate-300">Enable code scanner</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer">
                                  <input 
                                      type="checkbox" 
                                      checked={enableGameTime} 
                                      onChange={(e) => setEnableGameTime(e.target.checked)}
                                      className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600"
                                  />
                                  <span className="text-xs text-slate-300">Enable game time</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer">
                                  <input 
                                      type="checkbox" 
                                      checked={hideScore} 
                                      onChange={(e) => setHideScore(e.target.checked)}
                                      className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600"
                                  />
                                  <span className="text-xs text-slate-300">Hide score</span>
                              </label>
                          </div>

                          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                              <div>
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="text-[10px] font-bold text-white uppercase">Show score after having played for</label>
                                      <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px] uppercase">optional</span>
                                  </div>
                                  <input
                                      type="text"
                                      value={showScoreAfter}
                                      onChange={(e) => setShowScoreAfter(e.target.value.toUpperCase())}
                                      placeholder="HH:MM:SS"
                                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm font-mono placeholder:text-slate-600 outline-none focus:border-slate-500 uppercase"
                                  />
                              </div>
                              <div>
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="text-[10px] font-bold text-white uppercase">Hide score after having played for</label>
                                      <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px] uppercase">optional</span>
                                  </div>
                                  <input
                                      type="text"
                                      value={hideScoreAfter}
                                      onChange={(e) => setHideScoreAfter(e.target.value.toUpperCase())}
                                      placeholder="HH:MM:SS"
                                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm font-mono placeholder:text-slate-600 outline-none focus:border-slate-500 uppercase"
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Map/PLAYZONE Configuration Settings */}
                      {gameMode !== 'playzone' && (
                          <div className="text-[10px] font-bold text-white uppercase mb-2 text-center opacity-70">MAP CONFIGURATION SETTINGS</div>
                      )}
                      {gameMode === 'playzone' && (
                          <div className="text-[10px] font-bold text-white uppercase mb-2 text-center opacity-70">PLAYZONE CONFIGURATION SETTINGS</div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                          {/* Pin Settings / PLAYZONE Task Settings */}
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <label className="block text-[10px] font-bold text-white uppercase mb-4">{gameMode === 'playzone' ? 'PLAYZONE Task' : 'Pin'} settings</label>
                              <div className="space-y-3">
                                  <RadioOption
                                      label="Display task order on pin"
                                      selected={pinDisplayMode === 'order'}
                                      onClick={() => setPinDisplayMode('order')}
                                  />
                                  <RadioOption
                                      label="Display task score on map"
                                      selected={pinDisplayMode === 'score'}
                                      onClick={() => setPinDisplayMode('score')}
                                  />
                                  <RadioOption
                                      label="Display nothing on pin"
                                      selected={pinDisplayMode === 'none'}
                                      onClick={() => setPinDisplayMode('none')}
                                  />
                                  <div className="pt-2 border-t border-slate-800">
                                      <CheckboxOption
                                          label="Display task short intro under pin"
                                          checked={showShortIntroUnderPin}
                                          onChange={setShowShortIntroUnderPin}
                                      />
                                  </div>
                              </div>
                          </div>

                          {/* Map Interaction Settings - Only for GPS-based games */}
                          {gameMode !== 'playzone' && (
                              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                                  <label className="block text-[10px] font-bold text-white uppercase mb-4">Map interaction settings</label>
                                  <div className="space-y-3">
                                      <RadioOption
                                          label="Disable opening tasks on the map by click"
                                          selected={mapInteraction === 'disable_click'}
                                          onClick={() => setMapInteraction('disable_click')}
                                      />
                                      <RadioOption
                                          label="Allow opening all tasks on the map by click"
                                          selected={mapInteraction === 'allow_all'}
                                          onClick={() => setMapInteraction('allow_all')}
                                      />
                                      <RadioOption
                                          label="Allow opening specific tasks on map"
                                          selected={mapInteraction === 'allow_specific'}
                                          onClick={() => setMapInteraction('allow_specific')}
                                      />
                                  </div>
                              </div>
                          )}

                          {/* Additional Map Settings - Only for GPS-based games */}
                          {gameMode !== 'playzone' && (
                              <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                                  <label className="block text-[10px] font-bold text-white uppercase mb-4">Additional map settings</label>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <CheckboxOption
                                          label="Hide my location"
                                          checked={hideMyLocation}
                                          onChange={setHideMyLocation}
                                      />
                                      <CheckboxOption
                                          label="Show my track"
                                          checked={showMyTrack}
                                          onChange={setShowMyTrack}
                                      />
                                      <CheckboxOption
                                          label="Allow navigation"
                                          checked={allowNavigation}
                                          onChange={setAllowNavigation}
                                      />
                                      <CheckboxOption
                                          label="Allow opening tasks if GPS signal weak (beta)"
                                          checked={allowWeakGps}
                                          onChange={setAllowWeakGps}
                                      />
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              );
          case 'TASKS':
              return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2">
                      
                      {/* Time Limit */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <div className="flex justify-between items-center mb-4">
                              <label className="text-[10px] font-bold text-white uppercase">Time limit</label>
                              <Info className="w-3 h-3 text-slate-500" />
                          </div>
                          <div className="space-y-3">
                              <RadioOption 
                                  label="Tasks have no time limits" 
                                  selected={timeLimitMode === 'none'} 
                                  onClick={() => setTimeLimitMode('none')} 
                              />
                              <RadioOption 
                                  label="All tasks have a fixed time limit" 
                                  selected={timeLimitMode === 'global'} 
                                  onClick={() => setTimeLimitMode('global')} 
                              />
                              <RadioOption 
                                  label="Time limits are task-specific" 
                                  selected={timeLimitMode === 'task_specific'} 
                                  onClick={() => setTimeLimitMode('task_specific')} 
                              />
                          </div>
                          
                          {timeLimitMode === 'global' && (
                              <div className="mt-4 animate-in fade-in">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Time limit</label>
                                  <div className="flex items-center gap-2">
                                      <input
                                          type="number"
                                          value={globalTimeLimit}
                                          onChange={(e) => {
                                              const v = parseInt(e.target.value, 10);
                                              setGlobalTimeLimit(Number.isFinite(v) ? v : 0);
                                          }}
                                          className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-sm font-bold outline-none focus:border-orange-500 uppercase"
                                      />
                                      <span className="text-xs text-slate-400">SECONDS</span>
                                  </div>
                              </div>
                          )}
                      </div>

                      {/* Hints - Only for GPS-based games */}
                      {gameMode !== 'playzone' && (
                          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                              <label className="block text-[10px] font-bold text-white uppercase mb-4">Disable Hints</label>

                              <div className="flex items-center gap-3 mb-4">
                                  <input
                                      type="checkbox"
                                      checked={limitHints}
                                      onChange={(e) => setLimitHints(e.target.checked)}
                                      className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-600"
                                  />
                                  <span className="text-xs text-slate-300">Disable hints in game if available</span>
                              </div>

                              {limitHints && (
                                  <div className="animate-in fade-in">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hint number limit</label>
                                      <input
                                          type="number"
                                          value={hintLimit}
                                          onChange={(e) => {
                                              const v = parseInt(e.target.value, 10);
                                              setHintLimit(Number.isFinite(v) ? v : 0);
                                          }}
                                          placeholder="HINT NUMBER LIMIT..."
                                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm font-bold outline-none focus:border-orange-500 placeholder:text-slate-600 uppercase"
                                      />
                                  </div>
                              )}
                          </div>
                      )}

                      {/* Incorrect Answer Penalty */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-white uppercase mb-4">Incorrect answer penalty</label>
                          <div className="space-y-3">
                              <RadioOption 
                                  label="Incorrect answers give 0 points" 
                                  selected={penaltyMode === 'zero'} 
                                  onClick={() => setPenaltyMode('zero')} 
                              />
                              <RadioOption 
                                  label="Incorrect answers give negative points" 
                                  selected={penaltyMode === 'negative'} 
                                  onClick={() => setPenaltyMode('negative')} 
                              />
                          </div>
                      </div>

                      {/* Show Answer Correctness */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-white uppercase mb-4">Show answer correctness</label>
                          <div className="space-y-3">
                              <RadioOption 
                                  label="Don't show if the answer was correct or incorrect" 
                                  selected={showAnswerCorrectnessMode === 'never'} 
                                  onClick={() => setShowAnswerCorrectnessMode('never')} 
                              />
                              <RadioOption 
                                  label="Show if the answer was correct or incorrect" 
                                  selected={showAnswerCorrectnessMode === 'always'} 
                                  onClick={() => setShowAnswerCorrectnessMode('always')} 
                              />
                              <RadioOption 
                                  label="Use task-specific settings to show if the answer was correct or incorrect" 
                                  selected={showAnswerCorrectnessMode === 'task_specific'} 
                                  onClick={() => setShowAnswerCorrectnessMode('task_specific')} 
                              />
                          </div>
                      </div>

                      {/* Show Correct Answer */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-white uppercase mb-4">Show correct answer</label>
                          <div className="space-y-3">
                              <RadioOption 
                                  label="Don't show correct answer after user answers incorrectly" 
                                  selected={showCorrectAnswerMode === 'never'} 
                                  onClick={() => setShowCorrectAnswerMode('never')} 
                              />
                              <RadioOption 
                                  label="Show correct answer after user answers incorrectly" 
                                  selected={showCorrectAnswerMode === 'always'} 
                                  onClick={() => setShowCorrectAnswerMode('always')} 
                              />
                              <RadioOption 
                                  label="Use task-specific settings to show correct answer after user answers incorrectly" 
                                  selected={showCorrectAnswerMode === 'task_specific'} 
                                  onClick={() => setShowCorrectAnswerMode('task_specific')} 
                              />
                          </div>
                      </div>

                      {/* Show After-Answer Comment */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-white uppercase mb-4">Show after-answer comment</label>
                          <div className="space-y-3">
                              <RadioOption 
                                  label="Don't show after-answer comments" 
                                  selected={!showAfterAnswerComment} 
                                  onClick={() => setShowAfterAnswerComment(false)} 
                              />
                              <RadioOption 
                                  label="Show after-answer comment if available" 
                                  selected={showAfterAnswerComment} 
                                  onClick={() => setShowAfterAnswerComment(true)} 
                              />
                          </div>
                      </div>

                  </div>
              );
          case 'SETTINGS':
              return (
                  <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col min-h-[200px]">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">About Template</label>
                          <RichTextEditor 
                              value={aboutTemplate} 
                              onChange={setAboutTemplate} 
                              placeholder="Internal info about this game template..."
                          />
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col min-h-[200px]">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Notes for Instructor</label>
                          <RichTextEditor 
                              value={instructorNotes} 
                              onChange={setInstructorNotes} 
                              placeholder="Instructions for the game master..."
                          />
                      </div>
                  </div>
              );
          case 'TEAMS':
              return (
                  <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
                          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Player permissions</h3>
                          
                          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                              <div>
                                  <p className="text-xs font-bold text-white uppercase">Allow to see all scores</p>
                                  <p className="text-[10px] text-slate-500">Players can access the leaderboard</p>
                              </div>
                              <input 
                                  type="checkbox" 
                                  checked={showRanking} 
                                  onChange={(e) => setShowRanking(e.target.checked)}
                                  className="w-5 h-5 accent-orange-600 cursor-pointer"
                              />
                          </div>

                          {gameMode !== 'playzone' && (
                              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                                  <div>
                                      <p className="text-xs font-bold text-white uppercase">TEAMS can see other Team Captains on the map</p>
                                      <p className="text-[10px] text-slate-500">Only team captains are shown to reduce data traffic</p>
                                  </div>
                                  <input
                                      type="checkbox"
                                      checked={showOtherTeams}
                                      onChange={(e) => setShowOtherTeams(e.target.checked)}
                                      className="w-5 h-5 accent-orange-600 cursor-pointer"
                                  />
                              </div>
                          )}

                          {gameMode !== 'playzone' && (
                              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                                  <div>
                                      <p className="text-xs font-bold text-white uppercase">Track player locations</p>
                                      <p className="text-[10px] text-slate-500">Show player's own location on the map</p>
                                  </div>
                                  <input
                                      type="checkbox"
                                      checked={showPlayerLocations}
                                      onChange={(e) => setShowPlayerLocations(e.target.checked)}
                                      className="w-5 h-5 accent-orange-600 cursor-pointer"
                                  />
                              </div>
                          )}

                          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                              <div>
                                  <p className="text-xs font-bold text-white uppercase">Allow chatting</p>
                                  <p className="text-[10px] text-slate-500">Enable in-game chat for players</p>
                              </div>
                              <input 
                                  type="checkbox" 
                                  checked={allowChatting} 
                                  onChange={(e) => setAllowChatting(e.target.checked)}
                                  className="w-5 h-5 accent-orange-600 cursor-pointer"
                              />
                          </div>

                          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                              <div>
                                  <p className="text-xs font-bold text-white uppercase">Show task breakdown</p>
                                  <p className="text-[10px] text-slate-500">Players see detailed list: Completed/Total (X/Y)</p>
                              </div>
                              <input
                                  type="checkbox"
                                  checked={showTaskDetails}
                                  onChange={(e) => setShowTaskDetails(e.target.checked)}
                                  className="w-5 h-5 accent-orange-600 cursor-pointer"
                              />
                          </div>
                      </div>
                  </div>
              );
          case 'VOTE':
              return (
                  <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2">
                      {/* Team Voting Mode */}
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                          <label className="block text-[10px] font-bold text-white uppercase mb-4">Team Voting Mode</label>
                          <p className="text-xs text-slate-400 mb-4">How team answers are submitted for tasks</p>
                          <div className="space-y-3">
                              <RadioOption
                                  label="Require Consensus - All active members must agree"
                                  sublabel="Team must reach 100% agreement on answers (retired members don't count)"
                                  selected={teamVotingMode === 'require_consensus'}
                                  onClick={() => setTeamVotingMode('require_consensus')}
                              />
                              <RadioOption
                                  label="Captain Submit - Captain can submit without full consensus"
                                  sublabel="Captain can submit any time, team votes are visible but not required"
                                  selected={teamVotingMode === 'captain_submit'}
                                  onClick={() => setTeamVotingMode('captain_submit')}
                              />
                          </div>
                      </div>
                  </div>
              );
          case 'PLAYGROUNDS':
              const gamePlaygrounds = baseGame?.playgrounds || [];
              return (
                  <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between mb-4">
                          <div>
                              <h3 className="text-xl font-black text-white uppercase tracking-widest">GAME ZONES</h3>
                              <p className="text-xs text-slate-500 uppercase font-bold mt-1">
                                  {gamePlaygrounds.length} zone{gamePlaygrounds.length !== 1 ? 's' : ''} in this game
                              </p>
                          </div>
                          {onOpenPlaygroundEditor && gamePlaygrounds.length > 0 && (
                              <button
                                  onClick={() => onOpenPlaygroundEditor()}
                                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold uppercase text-xs tracking-wide flex items-center gap-2 transition-colors shadow-lg"
                              >
                                  <LayoutGrid className="w-4 h-4" />
                                  OPEN EDITOR
                              </button>
                          )}
                      </div>

                      {gamePlaygrounds.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 text-center p-10 bg-slate-900 border border-slate-800 rounded-2xl">
                              <LayoutGrid className="w-16 h-16 mb-4 text-slate-600" />
                              <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">NO ZONES YET</h3>
                              <p className="text-sm text-slate-400 max-w-xs uppercase mb-4">
                                  Playgrounds and zones are built using the visual editor.
                              </p>
                              {onOpenPlaygroundEditor && (
                                  <button
                                      onClick={() => onOpenPlaygroundEditor()}
                                      className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold uppercase text-xs tracking-wide flex items-center gap-2 transition-colors shadow-lg"
                                  >
                                      <Plus className="w-4 h-4" />
                                      CREATE FIRST ZONE
                                  </button>
                              )}
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {gamePlaygrounds.map((playground, index) => (
                                  <div
                                      key={playground.id}
                                      onClick={() => onOpenPlaygroundEditor?.(playground.id)}
                                      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:border-orange-500 transition-all group cursor-pointer flex flex-col"
                                  >
                                      <div className="aspect-video bg-slate-800 relative overflow-hidden">
                                          {playground.imageUrl ? (
                                              <img
                                                  src={playground.imageUrl}
                                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                  alt={playground.title}
                                              />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                  <LayoutGrid className="w-12 h-12" />
                                              </div>
                                          )}
                                          <div className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                                              ZONE #{index + 1}
                                          </div>
                                          {playground.buttonVisible && (
                                              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                                                  INTERACTIVE
                                              </div>
                                          )}
                                      </div>
                                      <div className="p-4 flex-1 flex flex-col">
                                          <h3 className="font-bold text-white uppercase truncate mb-2 group-hover:text-orange-400 transition-colors">
                                              {playground.title}
                                          </h3>
                                          <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold">
                                              {playground.orientationLock && playground.orientationLock !== 'none' && (
                                                  <span className="bg-slate-800 px-2 py-1 rounded">
                                                      {playground.orientationLock}
                                                  </span>
                                              )}
                                              {playground.audioUrl && (
                                                  <span className="bg-slate-800 px-2 py-1 rounded">
                                                      🔊 AUDIO
                                                  </span>
                                              )}
                                          </div>
                                          <div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                                              <span>Click to edit</span>
                                              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-500 transition-colors" />
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              );
          case 'LOGS':
              return (
                  <GameLogViewer game={baseGame} />
              );
          default:
              return null;
      }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-in fade-in">
        
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-800 flex justify-between items-center bg-slate-950 shrink-0 z-20 shadow-lg">
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3">
                {isEditMode ? <Edit className="w-5 h-5 text-orange-500" /> : <Gamepad2 className="w-5 h-5 text-orange-500" />}
                {isEditMode ? 'EDIT GAME SESSION' : 'NEW GAME SETUP'}
            </h2>
            <div className="flex items-center gap-3">
                {isEditMode && onDelete && (
                    <button 
                        onClick={handleDeleteClick}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all border ${deleteConfirm ? 'bg-red-600 text-white border-red-500' : 'bg-slate-900 text-red-500 border-slate-800 hover:bg-red-950'}`}
                    >
                        {deleteConfirm ? 'CONFIRM DELETE?' : 'DELETE'}
                    </button>
                )}
                <button
                    onClick={handleCreate}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-black uppercase text-xs tracking-widest shadow-lg flex items-center gap-2"
                >
                    <Save className="w-4 h-4" /> {isEditMode ? 'UPDATE' : 'SAVE'}
                </button>
                <div className="h-6 w-px bg-slate-800 mx-2"></div>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar Tabs */}
            <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-1">
                    {TABS.filter(tab => {
                        // Hide MAP tab for playzone mode only (elimination is GPS-based and needs map style selection)
                        if (gameMode === 'playzone' && tab.id === 'MAP') {
                            return false;
                        }
                        return true;
                    }).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold uppercase tracking-wide text-left group ${activeTab === tab.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-950 custom-scrollbar relative">
                {renderContent()}
            </div>

        </div>

        {/* JSON Help Modal */}
        {showJsonHelp && (
            <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                    <button onClick={() => setShowJsonHelp(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
                    <h3 className="text-lg font-black text-white uppercase mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-blue-500" /> Custom Map Style</h3>
                    
                    <ol className="list-decimal pl-4 space-y-3 text-xs text-slate-300 font-medium mb-6">
                        <li>Go to <a href="https://snazzymaps.com" target="_blank" className="text-blue-400 hover:underline font-bold">SnazzyMaps.com</a>.</li>
                        <li>Browse and select a style you like (e.g., "Midnight Commander").</li>
                        <li>Click the <strong>"Expand Code"</strong> or <strong>"Download"</strong> button.</li>
                        <li>Copy the entire <strong>JavaScript Style Array</strong> (it starts with <code>[</code> and ends with <code>]</code>).</li>
                        <li>Paste it into the text box in the editor.</li>
                    </ol>
                    
                    <div className="bg-orange-900/20 border border-orange-500/30 p-3 rounded-xl mb-4">
                        <p className="text-[10px] text-orange-300 font-bold uppercase flex items-start gap-2">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            Note: This style data is stored for use with Google Maps rendering engines. In this web preview (Leaflet), a default Dark theme is used as a placeholder.
                        </p>
                    </div>

                    <button onClick={() => setShowJsonHelp(false)} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-xs rounded-xl transition-colors">
                        Got it
                    </button>
                </div>
            </div>
        )}

        {/* Date & Time Picker Modal */}
        {showDateTimePicker && (
            <div className="fixed inset-0 z-[7000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                    <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-600/20 rounded-lg">
                                <Calendar className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase">SELECT END TIME</h3>
                                <p className="text-xs text-slate-400 uppercase font-bold mt-1">Choose date and time</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowDateTimePicker(false)}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6 flex justify-center">
                        <DatePicker
                            selected={endDateTime ? new Date(endDateTime) : new Date()}
                            onChange={(date: Date | null) => {
                                if (date) {
                                    // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const hours = String(date.getHours()).padStart(2, '0');
                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                    setEndDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
                                }
                            }}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={1}
                            timeCaption="Time"
                            dateFormat="MMMM d, yyyy h:mm aa"
                            inline
                            className="bg-slate-950"
                        />
                    </div>
                    <div className="p-4 border-t border-slate-700 bg-slate-950 flex gap-3">
                        <button
                            onClick={() => setShowDateTimePicker(false)}
                            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase text-xs transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setShowDateTimePicker(false)}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-bold uppercase text-xs transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            CONFIRM
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Meeting Point Map Picker Modal */}
        {showMapPicker && (
            <MeetingPointMapPicker
                initialLat={endLat ? parseFloat(endLat) : 55.6761}
                initialLng={endLng ? parseFloat(endLng) : 12.5683}
                onLocationSelect={(lat, lng) => {
                    setEndLat(lat.toString());
                    setEndLng(lng.toString());
                }}
                onClose={() => setShowMapPicker(false)}
            />
        )}

        {/* Map Style Preview Modal */}
        {showMapStylePreview && (previewMapStyle || previewCustomStyle) && (
            <div
                className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in"
                onClick={() => {
                    setShowMapStylePreview(false);
                    setPreviewCustomStyle(null);
                }}
            >
                <div
                    className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 border-b-2 border-blue-500 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase">Map Style Preview</h3>
                            <p className="text-xs text-blue-100 uppercase font-bold mt-1">
                                {previewCustomStyle ? previewCustomStyle.name : MAP_STYLES.find(s => s.id === previewMapStyle)?.label}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setShowMapStylePreview(false);
                                setPreviewCustomStyle(null);
                            }}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6">
                        {(() => {
                            const style = previewMapStyle ? MAP_STYLES.find(s => s.id === previewMapStyle) : null;
                            const previewUrl = previewCustomStyle?.previewUrl || style?.preview;

                            return (
                                <>
                                    {previewUrl ? (
                                        <div className="bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700 p-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Tile Preview (Original Size)</p>
                                                    <img
                                                        src={previewUrl}
                                                        alt={style?.label}
                                                        className={`w-full rounded-lg border border-slate-700 ${style?.className || ''}`}
                                                        crossOrigin="anonymous"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Zoomed Out Preview (2x2 Tiles)</p>
                                                    <div className="aspect-square rounded-lg border border-slate-700 overflow-hidden bg-slate-900">
                                                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                                            <img
                                                                src={previewUrl}
                                                                alt={`${style?.label} - tile 1`}
                                                                className={`w-full h-full object-cover ${style?.className || ''}`}
                                                                crossOrigin="anonymous"
                                                            />
                                                            <img
                                                                src={previewUrl}
                                                                alt={`${style?.label} - tile 2`}
                                                                className={`w-full h-full object-cover ${style?.className || ''}`}
                                                                crossOrigin="anonymous"
                                                            />
                                                            <img
                                                                src={previewUrl}
                                                                alt={`${style?.label} - tile 3`}
                                                                className={`w-full h-full object-cover ${style?.className || ''}`}
                                                                crossOrigin="anonymous"
                                                            />
                                                            <img
                                                                src={previewUrl}
                                                                alt={`${style?.label} - tile 4`}
                                                                className={`w-full h-full object-cover ${style?.className || ''}`}
                                                                crossOrigin="anonymous"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                                                <p className="text-xs text-slate-400">
                                                    <span className="font-bold text-white">Note:</span> The left shows a single map tile, the right shows how multiple tiles connect.
                                                    The actual map will cover your entire game area with this visual style.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-950 rounded-xl border-2 border-slate-700 p-8 flex flex-col items-center justify-center gap-4">
                                            <EyeOff className="w-16 h-16 text-slate-600" />
                                            <p className="text-sm text-slate-400 text-center">
                                                No preview available for this map style
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-4 flex gap-3 justify-end">
                                        <button
                                            onClick={() => window.open('https://www.openstreetmap.org/#map=13/55.6761/12.5683', '_blank')}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-xs transition-all flex items-center gap-2"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open in OpenStreetMap
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (previewCustomStyle) {
                                                    setSelectedMapStyle('google_custom');
                                                    setCustomMapJson(previewCustomStyle.json);
                                                    setJsonValidationStatus('VALID');
                                                } else if (previewMapStyle) {
                                                    setSelectedMapStyle(previewMapStyle);
                                                }
                                                setShowMapStylePreview(false);
                                                setPreviewCustomStyle(null);
                                            }}
                                            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold uppercase text-xs transition-all flex items-center gap-2"
                                        >
                                            <Check className="w-4 h-4" />
                                            Use This Style
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
        )}

        {/* Snazzy Maps Browser Modal */}
        {showSnazzyMapsBrowser && (
            <div
                className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in"
                onClick={() => setShowSnazzyMapsBrowser(false)}
            >
                <div
                    className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4 border-b-2 border-purple-500 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase">Browse Snazzy Maps</h3>
                            <p className="text-xs text-purple-100 uppercase font-bold mt-1">Find and import custom Google Map styles</p>
                        </div>
                        <button
                            onClick={() => setShowSnazzyMapsBrowser(false)}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 mb-4">
                            <h4 className="text-sm font-black text-white uppercase mb-2 flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-400" />
                                How to Import from Snazzy Maps
                            </h4>
                            <ol className="text-xs text-slate-300 space-y-2">
                                <li className="flex gap-2">
                                    <span className="text-orange-500 font-bold">1.</span>
                                    <span>Click "Browse Snazzy Maps" below to open the website</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-orange-500 font-bold">2.</span>
                                    <span>Find a map style you like and click on it</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-orange-500 font-bold">3.</span>
                                    <span>Scroll down and click "Copy JSON" button</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-orange-500 font-bold">4.</span>
                                    <span>Return here, select "Google Custom" map style, and paste the JSON</span>
                                </li>
                            </ol>
                        </div>
                        <div className="aspect-video w-full rounded-xl overflow-hidden border-2 border-slate-700">
                            <iframe
                                src="https://snazzymaps.com/explore"
                                className="w-full h-full"
                                title="Snazzy Maps Browser"
                            />
                        </div>
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => window.open('https://snazzymaps.com/explore', '_blank')}
                                className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold uppercase text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Browse Snazzy Maps
                            </button>
                            <button
                                onClick={() => {
                                    setShowSnazzyMapsBrowser(false);
                                    setSelectedMapStyle('google_custom');
                                }}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold uppercase text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <Code className="w-4 h-4" />
                                Go to JSON Import
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Create Custom Style Modal */}
        {showCreateStyleModal && (
            <div
                className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in"
                onClick={() => setShowCreateStyleModal(false)}
            >
                <div
                    className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4 border-b-2 border-orange-500 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase">Create Custom Style</h3>
                            <p className="text-xs text-orange-100 uppercase font-bold mt-1">Save this style to your library</p>
                        </div>
                        <button
                            onClick={() => setShowCreateStyleModal(false)}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 mb-4">
                            <p className="text-xs text-slate-400 mb-3">
                                <span className="font-bold text-white">Note:</span> This will save your current custom JSON style
                                to your library so you can easily reuse it in other games.
                            </p>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Style Name</label>
                            <input
                                type="text"
                                value={customStyleName}
                                onChange={(e) => setCustomStyleName(e.target.value)}
                                placeholder="e.g., Dark Blue Theme, Vintage Map, etc."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 outline-none focus:border-orange-500 transition-colors"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleCreateCustomStyle();
                                    }
                                }}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCreateStyleModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase text-xs transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateCustomStyle}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold uppercase text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Create Style
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Gemini API Key Modal */}
        <GeminiApiKeyModal
            isOpen={showGeminiKeyModal}
            onClose={() => setShowGeminiKeyModal(false)}
            onSave={() => {
                // Retry logo generation after API key is saved
                handleGenerateAiLogo();
            }}
        />
    </div>
  );
};

export default GameCreator;
