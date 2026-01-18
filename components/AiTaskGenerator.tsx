import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Wand2, X, Plus, Check, RefreshCw, ThumbsUp, ThumbsDown, Loader2, Sparkles, AlertCircle, Ban, Edit2, Globe, Tag, Image as ImageIcon, Home, Search, Hash, Save, Library, Gamepad2, Map, LayoutGrid, ArrowRight, LayoutList, Settings2, Target, Circle, Palette, MapPin, Music, Play, Square, QrCode, MousePointerClick } from 'lucide-react';
import { TaskTemplate, Playground, TaskList, IconId } from '../types';
import { generateAiTasks, generateAiImage, searchLogoUrl, generateMoodAudio, hasApiKey } from '../services/ai';
import { ICON_COMPONENTS } from '../utils/icons';
import { getUniqueTaskKey } from '../utils/taskKeyUtils';
import GeminiApiKeyModal from './GeminiApiKeyModal';
import { fetchUniqueTags } from '../services/db';

interface AiTaskGeneratorProps {
  onClose: () => void;
  onAddTasks: (tasks: TaskTemplate[], targetPlaygroundId?: string | null) => void;
  onAddToLibrary?: (tasks: TaskTemplate[]) => void;
  onAddTasksToList?: (listId: string, tasks: TaskTemplate[]) => void;
  onCreateListWithTasks?: (name: string, tasks: TaskTemplate[]) => void;
  playgrounds?: Playground[];
  taskLists?: TaskList[];
  initialPlaygroundId?: string | null;
  targetMode?: 'GAME' | 'LIBRARY' | 'LIST';
}

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

const BATCH_COLORS = [
    { name: 'None', value: '' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Gray', value: '#64748b' },
    { name: 'Yellow', value: '#eab308' },
];

const AiTaskGenerator: React.FC<AiTaskGeneratorProps> = ({ onClose, onAddTasks, onAddToLibrary, onAddTasksToList, onCreateListWithTasks, playgrounds = [], taskLists = [], initialPlaygroundId = null, targetMode = 'GAME' }) => {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('🇩🇰 Danish (Dansk)');
  const [taskCount, setTaskCount] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [showAutoTagSuggestions, setShowAutoTagSuggestions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTaskCount, setCurrentTaskCount] = useState(0);
  const [totalTaskCount, setTotalTaskCount] = useState(0);
  const [generatedBuffer, setGeneratedBuffer] = useState<TaskTemplate[]>([]);
  const [approvedTasks, setApprovedTasks] = useState<TaskTemplate[]>([]);
  const [resultsTab, setResultsTab] = useState<'REVIEW' | 'APPROVED'>('REVIEW');
  const [error, setError] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [useLogoForTasks, setUseLogoForTasks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [batchFinished, setBatchFinished] = useState(false);
  const [showGeminiKeyModal, setShowGeminiKeyModal] = useState(false);
  const [pendingGenerationParams, setPendingGenerationParams] = useState<{topic: string; taskCount: number; language: string; autoTag: string} | null>(null);

  // Clear old cached tasks on mount to prevent duplicate key errors from stale IDs
  useEffect(() => {
    // Validate and filter out tasks with old ID format (ai-{timestamp}-{index} without random suffix)
    const isOldIdFormat = (id: string): boolean => {
      // New format: ai-{timestamp}-{randomString} (random part is 10-13 chars)
      // Old format: ai-{timestamp}-{index} or ai-{timestamp}-{index}-{shortRandom}
      const parts = id.split('-');
      if (parts.length < 3) return true; // Invalid or very old format

      const lastPart = parts[parts.length - 1];
      // If last part is a single digit (0-9), it's the old index-based format
      if (/^\d+$/.test(lastPart) && lastPart.length < 2) return true;

      // If last part is short (less than 7 chars), might be old format
      if (lastPart.length < 7) return true;

      return false;
    };

    // Clear any tasks with old ID formats
    setGeneratedBuffer(prev => {
      const filtered = prev.filter(task => !isOldIdFormat(task.id));
      if (filtered.length !== prev.length) {
        console.warn(`[AI Generator] Cleared ${prev.length - filtered.length} tasks with old ID format`);
      }
      return filtered;
    });

    setApprovedTasks(prev => {
      const filtered = prev.filter(task => !isOldIdFormat(task.id));
      if (filtered.length !== prev.length) {
        console.warn(`[AI Generator] Cleared ${prev.length - filtered.length} approved tasks with old ID format`);
      }
      return filtered;
    });

    fetchUniqueTags().then(tags => setExistingTags(tags)).catch(() => setExistingTags([]));
  }, []);

  const autoTagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];

    return existingTags
      .filter(t => t.toLowerCase().includes(q))
      .filter(t => t.toLowerCase() !== q)
      .filter(t => !selectedTags.includes(t)) // Exclude already selected tags
      .slice(0, 8);
  }, [tagInput, existingTags, selectedTags]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
    setShowAutoTagSuggestions(false);
  };

  const removeTag = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  // Destination State
  const [destinationType, setDestinationType] = useState<'MAP' | 'PLAYGROUND'>(initialPlaygroundId ? 'PLAYGROUND' : 'MAP');
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<string | null>(initialPlaygroundId || (playgrounds.length > 0 ? playgrounds[0].id : null));
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  // Batch Settings
  const [batchIcon, setBatchIcon] = useState<IconId | 'auto'>('auto');
  const [batchColor, setBatchColor] = useState<string>('');
  const [batchRadius, setBatchRadius] = useState<number>(30);
  const [batchPoints, setBatchPoints] = useState<number>(100);
  // Activation types: 'radius' (GPS), 'click' (Click to open), 'qr' (Scan QR)
  const [activationTypes, setActivationTypes] = useState<string[]>(['radius']);
  const [showAllIcons, setShowAllIcons] = useState(false);

  // Sound Settings
  const [batchAudioUrl, setBatchAudioUrl] = useState<string | null>(null);
  const [isGeneratingSound, setIsGeneratingSound] = useState(false);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // If mode is LIST or LIBRARY, default behavior adjustments
  useEffect(() => {
      if (targetMode === 'LIST' || targetMode === 'LIBRARY') {
          setSaveToLibrary(true); // Always true for these modes essentially
      }
  }, [targetMode]);

  const isActiveRef = useRef(false);
  const topicInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
      return () => { isActiveRef.current = false; };
  }, []);

  const handleSearchLogo = async () => {
      if (!topic.trim()) return;
      setIsGeneratingLogo(true);
      setLogoUrl(null);
      setError(null);

      try {
          const url = await searchLogoUrl(topic);
          if (url) {
              setLogoUrl(url);
              setUseLogoForTasks(true);
          } else {
              setError("Could not find a logo for this topic.");
          }
      } catch (e) {
          setError("Error searching for logo.");
      } finally {
          setIsGeneratingLogo(false);
      }
  };

  const handleGenerateAiImage = async () => {
      if (!topic.trim()) return;
      setIsGeneratingAiImage(true);
      setLogoUrl(null);
      setError(null);

      try {
          const url = await generateAiImage(topic, 'thematic');
          if (url) {
              setLogoUrl(url);
              setUseLogoForTasks(true);
          } else {
              setError("Could not generate AI image. Check Gemini API key.");
          }
      } catch (e) {
          setError("Error generating AI image. Check API key.");
      } finally {
          setIsGeneratingAiImage(false);
      }
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Create canvas to resize image
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
          img.onload = () => {
              // Target size: 256x256 for task images
              const targetSize = 256;
              const canvas = document.createElement('canvas');
              canvas.width = targetSize;
              canvas.height = targetSize;
              const ctx = canvas.getContext('2d');

              if (ctx) {
                  // Fill with white background
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, targetSize, targetSize);

                  // Calculate scaling to fit image while maintaining aspect ratio
                  const scale = Math.min(targetSize / img.width, targetSize / img.height);
                  const scaledWidth = img.width * scale;
                  const scaledHeight = img.height * scale;
                  const offsetX = (targetSize - scaledWidth) / 2;
                  const offsetY = (targetSize - scaledHeight) / 2;

                  // Draw scaled image centered
                  ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

                  // Convert to data URL
                  const dataUrl = canvas.toDataURL('image/png', 0.9);
                  setLogoUrl(dataUrl);
                  setUseLogoForTasks(true);
              }
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);

      // Reset input so same file can be selected again
      e.target.value = '';
  };

  const handleGenerateSound = async () => {
      if (!topic.trim()) return;
      setIsGeneratingSound(true);
      // Don't clear main error, audio is optional

      try {
          const url = await generateMoodAudio(topic);
          if (url) {
              setBatchAudioUrl(url);
          } else {
              // Show temporary error that auto-dismisses
              setError("Audio generation failed (optional feature). You can still generate tasks.");
              setTimeout(() => setError(prev => prev?.includes("Audio") ? null : prev), 4000);
          }
      } catch (e) {
          // Show temporary error that auto-dismisses
          setError("Audio generation failed (optional). You can still generate tasks.");
          setTimeout(() => setError(prev => prev?.includes("Audio") ? null : prev), 4000);
      } finally {
          setIsGeneratingSound(false);
      }
  };

  const handlePlaySound = () => {
      if (audioRef.current && batchAudioUrl) {
          if (isPlayingSound) {
              audioRef.current.pause();
              setIsPlayingSound(false);
          } else {
              audioRef.current.play();
              setIsPlayingSound(true);
          }
      }
  };

  const handleClearAll = () => {
    setGeneratedBuffer([]);
    setApprovedTasks([]);
    setError(null);
    setBatchFinished(false);
    console.log('[AI Generator] All tasks cleared');
  };

  const handleGenerate = async (generateMore: boolean = false) => {
    if (!topic.trim()) return;

    // Auto-generate tag from topic if none provided
    let tagsToUse = [...selectedTags];
    if (tagsToUse.length === 0) {
        // Use first word of topic as tag
        const autoTag = topic.trim().split(/\s+/)[0].substring(0, 20);
        tagsToUse = [autoTag];
        setSelectedTags([autoTag]);
    }

    // Check if API key is configured first
    if (!hasApiKey()) {
        setPendingGenerationParams({topic, taskCount, language, autoTag: tagsToUse[0]});
        setShowGeminiKeyModal(true);
        return;
    }

    // Only clear if not generating more
    if (!generateMore) {
        setGeneratedBuffer([]);
        setApprovedTasks([]);
    } else {
        // When generating more, only clear the review buffer
        setGeneratedBuffer([]);
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setCurrentTaskCount(0);
    setTotalTaskCount(taskCount);
    setBatchFinished(false);
    setResultsTab('REVIEW');
    isActiveRef.current = true;

    try {
      const newTasks = await generateAiTasks(topic, taskCount, language, tagsToUse[0], (current, total) => {
        // Progress callback
        setCurrentTaskCount(current);
        setTotalTaskCount(total);
        setProgress((current / total) * 100);
      });

      if (!isActiveRef.current) {
          return;
      }

      let imageUrlToUse = logoUrl && useLogoForTasks ? logoUrl : null;

      if (!imageUrlToUse) {
          // If no logo, try generating an image
          try {
            const thematicImage = await generateAiImage(topic, 'scavenger');
            if (thematicImage) {
                imageUrlToUse = thematicImage;
            }
          } catch (e) {
              console.warn("Image gen failed", e);
          }
      }

      if (imageUrlToUse && isActiveRef.current) {
          newTasks.forEach(t => {
              t.task.imageUrl = imageUrlToUse!;
          });
      }

      // Apply all selected tags to tasks
      if (tagsToUse.length > 0) {
          newTasks.forEach(t => {
              // Merge existing tags with selected tags (keep AI tag, add user tags)
              const existingTags = t.tags || [];
              const allTags = [...new Set([...existingTags, ...tagsToUse])];
              t.tags = allTags;
          });
      }

      setProgress(100);

      setTimeout(() => {
          if (isActiveRef.current) {
              setGeneratedBuffer(newTasks);
              setIsGenerating(false);
              setProgress(0);
              setCurrentTaskCount(0);
              setTotalTaskCount(0);
              setBatchFinished(true);
          }
      }, 500);

    } catch (err: any) {
        if (isActiveRef.current) {
            const errorMessage = err.message || "Failed to generate tasks.";
            if (errorMessage.includes('AI API Key missing')) {
                setPendingGenerationParams({topic, taskCount, language, autoTag});
                setShowGeminiKeyModal(true);
                setProgress(0);
            } else {
                setError(errorMessage);
            }
            setIsGenerating(false);
        }
    }
  };

  const handleApiKeySaved = () => {
    // Retry with the pending generation parameters
    if (pendingGenerationParams) {
      setTopic(pendingGenerationParams.topic);
      setTaskCount(pendingGenerationParams.taskCount);
      setLanguage(pendingGenerationParams.language);
      setAutoTag(pendingGenerationParams.autoTag);
      setPendingGenerationParams(null);
      // Retry the generation
      setTimeout(() => {
        handleGenerate();
      }, 100);
    }
  };

  const handleApproveTask = (task: TaskTemplate) => {
      setApprovedTasks(prev => [...prev, task]);
      setGeneratedBuffer(prev => prev.filter(t => t.id !== task.id));
  };

  const handleDiscardTask = (id: string) => {
      setGeneratedBuffer(prev => prev.filter(t => t.id !== id));
  };

  const handleApproveAll = () => {
      setApprovedTasks(prev => [...prev, ...generatedBuffer]);
      setGeneratedBuffer([]);
  };

  const handleSaveApproved = () => {
      if (approvedTasks.length === 0) return;

      // Apply batch settings
      // For MAP mode, always include 'radius' in activation types
      const finalActivationTypes = destinationType === 'MAP'
          ? [...new Set(['radius', ...activationTypes])] // Ensure radius is included for map
          : activationTypes;

      const finalTasks = approvedTasks.map(t => ({
          ...t,
          iconId: batchIcon !== 'auto' ? batchIcon : t.iconId,
          points: batchPoints,
          activationTypes: finalActivationTypes,
          // We attach these as custom properties that onAddTasks in App.tsx will look for
          // Using casting to bypass strict TaskTemplate check for these transient props
          radiusMeters: batchRadius,
          areaColor: batchColor,
          openingAudioUrl: batchAudioUrl || undefined
      })) as TaskTemplate[];

      // 1. Add to Game (Map or Playground)
      if (targetMode === 'GAME') {
          if (destinationType === 'MAP') {
              // For MAP mode: pass undefined (not null) to indicate map-level tasks
              onAddTasks(finalTasks, undefined);
          } else {
              // 'PLAYGROUND' mode: pass the selected playground ID
              // selectedPlaygroundId could be 'CREATE_NEW' or an ID
              onAddTasks(finalTasks, selectedPlaygroundId);
          }

          // For GAME mode, always auto-save to library
          if (onAddToLibrary) {
              onAddToLibrary(finalTasks);
          }
      }
      // 2. Add to Library OR Task List (based on user choice)
      else if (targetMode === 'LIBRARY') {
          if (librarySaveTarget === 'list') {
              // Save to task list
              if (selectedTaskListId === 'NEW') {
                  if (onCreateListWithTasks && newListName.trim()) {
                      onCreateListWithTasks(newListName.trim(), finalTasks);
                  }
              } else if (selectedTaskListId && onAddTasksToList) {
                  onAddTasksToList(selectedTaskListId, finalTasks);
              }
          } else {
              // Save to library
              if (onAddToLibrary) {
                  onAddToLibrary(finalTasks);
              }
          }
      }
      // 3. Add to List / Create List
      else if (targetMode === 'LIST') {
          if (selectedTaskListId === 'NEW') {
              if (onCreateListWithTasks && newListName) {
                  onCreateListWithTasks(newListName, finalTasks);
              }
          } else {
              if (onAddTasksToList && selectedTaskListId) {
                  onAddTasksToList(selectedTaskListId, finalTasks);
              }
          }
      }

      // Also save to library if checkbox checked (only if not already saved)
      if (saveToLibrary && targetMode !== 'LIBRARY' && targetMode !== 'GAME' && onAddToLibrary) {
          onAddToLibrary(finalTasks);
      }

      onClose();
  };

  // For LIBRARY mode, allow saving to library OR task list
  const [librarySaveTarget, setLibrarySaveTarget] = useState<'library' | 'list'>('library');

  const renderDestinationSelector = () => {
      if (targetMode === 'LIBRARY') {
          return (
              <div className="space-y-3 mb-4">
                  {/* Toggle: Library vs Task List */}
                  <div className="flex bg-slate-800 p-1 rounded-xl">
                      <button
                          type="button"
                          onClick={() => setLibrarySaveTarget('library')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${librarySaveTarget === 'library' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      >
                          <Library className="w-3 h-3" /> LIBRARY
                      </button>
                      <button
                          type="button"
                          onClick={() => setLibrarySaveTarget('list')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${librarySaveTarget === 'list' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      >
                          <LayoutList className="w-3 h-3" /> TASK LIST
                      </button>
                  </div>

                  {librarySaveTarget === 'library' ? (
                      <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-xl text-center">
                          <p className="text-purple-300 font-bold text-[10px] uppercase tracking-widest">SAVING TO GLOBAL LIBRARY</p>
                      </div>
                  ) : (
                      <div className="space-y-2">
                          <select
                              value={selectedTaskListId}
                              onChange={(e) => setSelectedTaskListId(e.target.value)}
                              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-orange-500 uppercase"
                          >
                              <option value="" disabled>SELECT LIST...</option>
                              <option value="NEW">+ CREATE NEW LIST</option>
                              {taskLists?.map(l => (
                                  <option key={l.id} value={l.id}>{l.name} ({l.tasks?.length || 0})</option>
                              ))}
                          </select>
                          {selectedTaskListId === 'NEW' && (
                              <input
                                  type="text"
                                  value={newListName}
                                  onChange={(e) => setNewListName(e.target.value)}
                                  placeholder="Enter list name..."
                                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-orange-500"
                              />
                          )}
                      </div>
                  )}
              </div>
          );
      }

      if (targetMode === 'LIST') {
          return (
              <div className="space-y-4 mb-6">
                  <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">TARGET LIST</label>
                      <select 
                          value={selectedTaskListId} 
                          onChange={(e) => setSelectedTaskListId(e.target.value)}
                          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-bold outline-none focus:border-purple-500 uppercase"
                      >
                          <option value="" disabled>SELECT LIST...</option>
                          <option value="NEW">+ CREATE NEW LIST</option>
                          {taskLists?.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                      </select>
                  </div>
                  {selectedTaskListId === 'NEW' && (
                      <input 
                          type="text" 
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          placeholder="ENTER LIST NAME..."
                          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-bold outline-none focus:border-purple-500 uppercase"
                      />
                  )}
              </div>
          );
      }

      // Default GAME mode
      return (
          <div className="space-y-4 mb-6">
              <div className="flex bg-gray-800 p-1 rounded-xl">
                  <button 
                      onClick={() => setDestinationType('MAP')} 
                      className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${destinationType === 'MAP' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                  >
                      MAIN MAP
                  </button>
                  <button 
                      onClick={() => setDestinationType('PLAYGROUND')} 
                      className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${destinationType === 'PLAYGROUND' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                  >
                      PLAYGROUND
                  </button>
              </div>

              {destinationType === 'PLAYGROUND' && (
                  <select 
                      value={selectedPlaygroundId || ''} 
                      onChange={(e) => setSelectedPlaygroundId(e.target.value)}
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-bold outline-none focus:border-blue-500 uppercase"
                  >
                      <option value="CREATE_NEW">+ CREATE NEW ZONE</option>
                      {playgrounds.map(pg => (
                          <option key={pg.id} value={pg.id}>{pg.title}</option>
                      ))}
                  </select>
              )}

              <div className="flex items-center gap-2 px-1">
                  <input 
                      type="checkbox" 
                      id="saveLib" 
                      checked={saveToLibrary} 
                      onChange={(e) => setSaveToLibrary(e.target.checked)} 
                      className="rounded bg-gray-700 border-gray-600 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="saveLib" className="text-xs font-bold text-gray-400 uppercase cursor-pointer">ALSO SAVE TO LIBRARY</label>
              </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[9100] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300">
        <div className="bg-[#0f172a] border border-slate-800 w-full max-w-7xl h-[95vh] md:h-[90vh] rounded-2xl md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">

            {/* Header - Compact */}
            <div className="px-4 py-3 md:p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                        <Wand2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-base md:text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                            AI TASK GENERATOR
                            <span className="text-[8px] md:text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">BETA</span>
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">CLAUDE (TEXT) + STABILITY AI (IMAGES)</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">

                {/* Left Panel: Controls - Wider with compact layout */}
                <div className="w-[340px] lg:w-[400px] bg-slate-900/50 border-r border-slate-800 p-3 md:p-4 overflow-y-auto custom-scrollbar flex flex-col">
                    <div className="space-y-3">
                        {/* Topic Input - Compact */}
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">TOPIC / THEME</label>
                            <textarea
                                ref={topicInputRef}
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g. Historical monuments in Copenhagen..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm font-medium outline-none focus:border-purple-500 transition-colors h-16 resize-none"
                            />
                        </div>

                        {/* Branding - Compact row */}
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <ImageIcon className="w-3 h-3" /> BRANDING
                                </label>
                                {(isGeneratingLogo || isGeneratingAiImage) && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                            </div>

                            {logoUrl ? (
                                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-green-500/30">
                                    <div className="relative group">
                                        <img src={logoUrl} className="w-8 h-8 object-contain bg-white rounded cursor-pointer" />
                                        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden group-hover:block z-[9999] animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                                            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-700 shadow-2xl">
                                                <img src={logoUrl} className="max-w-[400px] max-h-[400px] w-auto h-auto object-contain bg-white rounded-xl" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-center gap-2">
                                        <input type="checkbox" id="useLogo" checked={useLogoForTasks} onChange={(e) => setUseLogoForTasks(e.target.checked)} className="rounded bg-slate-700 border-slate-600 text-purple-600 w-3 h-3" />
                                        <label htmlFor="useLogo" className="text-[8px] text-green-400 font-bold uppercase cursor-pointer">USE FOR TASKS</label>
                                    </div>
                                    <button onClick={() => { setLogoUrl(null); setUseLogoForTasks(false); }} className="p-1 text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                                </div>
                            ) : (
                                <div className="flex gap-1.5">
                                    <button onClick={handleSearchLogo} disabled={!topic || isGeneratingLogo || isGeneratingAiImage} className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-[8px] font-bold uppercase rounded-lg flex items-center justify-center gap-1">
                                        <Search className="w-2.5 h-2.5" /> LOGO
                                    </button>
                                    <button onClick={handleGenerateAiImage} disabled={!topic || isGeneratingLogo || isGeneratingAiImage} className="flex-1 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 disabled:opacity-50 text-purple-300 text-[8px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 border border-purple-500/30">
                                        <Sparkles className="w-2.5 h-2.5" /> AI
                                    </button>
                                    <button onClick={() => fileInputRef.current?.click()} disabled={isGeneratingLogo || isGeneratingAiImage} className="flex-1 py-1.5 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[8px] font-bold uppercase rounded-lg flex items-center justify-center gap-1 border border-dashed border-slate-600">
                                        <ImageIcon className="w-2.5 h-2.5" /> UP
                                    </button>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
                        </div>

                        {/* Settings */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">COUNT</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="20" 
                                    value={taskCount}
                                    onChange={(e) => setTaskCount(parseInt(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:border-purple-500 text-center"
                                />
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">TAGS</label>
                                <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 min-h-[48px] focus-within:border-purple-500">
                                    {/* Selected tags chips */}
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {selectedTags.map(tag => (
                                            <span key={tag} className="inline-flex items-center gap-1 bg-purple-600/30 text-purple-300 text-[9px] font-bold uppercase px-2 py-1 rounded-lg">
                                                <Hash className="w-2.5 h-2.5" />
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => removeTag(tag)}
                                                    className="ml-0.5 hover:text-red-400 transition-colors"
                                                >
                                                    <X className="w-2.5 h-2.5" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    {/* Tag input */}
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => { setTagInput(e.target.value); setShowAutoTagSuggestions(true); }}
                                        onFocus={() => setShowAutoTagSuggestions(true)}
                                        onBlur={() => window.setTimeout(() => setShowAutoTagSuggestions(false), 150)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && tagInput.trim()) {
                                                e.preventDefault();
                                                addTag(tagInput);
                                            }
                                        }}
                                        placeholder={selectedTags.length === 0 ? "Add tags..." : "Add more..."}
                                        className="w-full bg-transparent text-white text-xs font-bold outline-none placeholder:text-slate-500"
                                    />
                                </div>

                                {showAutoTagSuggestions && autoTagSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50">
                                        {autoTagSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => addTag(suggestion)}
                                                className="w-full px-3 py-2 text-left text-xs text-white font-bold uppercase hover:bg-slate-800 transition-colors flex items-center gap-2"
                                            >
                                                <Hash className="w-3 h-3 text-purple-400" />
                                                <span className="truncate">{suggestion}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">LANGUAGE</label>
                            <select 
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-purple-500 uppercase"
                            >
                                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>

                        {/* Batch Settings */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-1">
                                <Settings2 className="w-3 h-3" /> TASK DEFAULTS
                            </label>
                            
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">POINTS</label>
                                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2">
                                        <Target className="w-3 h-3 text-orange-500 mr-2" />
                                        <input 
                                            type="number"
                                            value={batchPoints}
                                            onChange={(e) => setBatchPoints(parseInt(e.target.value))}
                                            className="w-full bg-transparent py-2 text-white font-bold text-xs outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">RADIUS (M)</label>
                                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2">
                                        <Circle className="w-3 h-3 text-blue-500 mr-2" />
                                        <input 
                                            type="number"
                                            value={batchRadius}
                                            onChange={(e) => setBatchRadius(parseInt(e.target.value))}
                                            className="w-full bg-transparent py-2 text-white font-bold text-xs outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3" /> ICON</label>
                                <div className={`grid gap-1.5 ${showAllIcons ? 'grid-cols-6' : 'grid-cols-6'}`}>
                                    <button
                                        onClick={() => setBatchIcon('auto')}
                                        className={`aspect-square rounded border flex items-center justify-center transition-all ${batchIcon === 'auto' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                        title="AI Auto-Select"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                    </button>
                                    {Object.keys(ICON_COMPONENTS).slice(0, showAllIcons ? undefined : 4).map((iconKey) => {
                                        const Icon = ICON_COMPONENTS[iconKey as IconId];
                                        return (
                                            <button
                                                key={iconKey}
                                                onClick={() => setBatchIcon(iconKey as IconId)}
                                                className={`aspect-square rounded border flex items-center justify-center transition-all ${batchIcon === iconKey ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                                title={iconKey}
                                            >
                                                <Icon className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                    {!showAllIcons && (
                                        <button
                                            onClick={() => setShowAllIcons(true)}
                                            className="aspect-square rounded border border-dashed border-slate-600 flex items-center justify-center transition-all bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-white"
                                            title="Show all icons"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {showAllIcons && (
                                    <button
                                        onClick={() => setShowAllIcons(false)}
                                        className="mt-2 text-[8px] text-slate-500 hover:text-slate-300 uppercase font-bold"
                                    >
                                        ▲ Show less
                                    </button>
                                )}
                            </div>

                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block flex items-center gap-1"><Palette className="w-3 h-3" /> AREA COLOR</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {BATCH_COLORS.map((c) => (
                                        <button
                                            key={c.name}
                                            onClick={() => setBatchColor(c.value)}
                                            className={`w-5 h-5 rounded-full border-2 transition-all ${batchColor === c.value ? 'border-white scale-110 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                                            style={{ backgroundColor: c.value || '#334155' }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                        </div>

                        {/* Opening Sound - Separate Section */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-indigo-500/20">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-1">
                                <Music className="w-3 h-3 text-indigo-400" /> OPENING SOUND
                                <span className="text-[7px] bg-indigo-900/50 text-indigo-400 px-1.5 py-0.5 rounded ml-1">BETA</span>
                            </label>
                            <div className="space-y-2">
                                <button
                                    onClick={handleGenerateSound}
                                    disabled={!topic.trim() || isGeneratingSound}
                                    className={`w-full py-2.5 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${
                                        isGeneratingSound
                                            ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                                            : batchAudioUrl
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 border border-indigo-600/40 hover:border-indigo-500'
                                    }`}
                                    type="button"
                                >
                                    {isGeneratingSound ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            GENERATING...
                                        </>
                                    ) : batchAudioUrl ? (
                                        <>
                                            <Check className="w-3 h-3" />
                                            SOUND READY
                                        </>
                                    ) : (
                                        <>
                                            <Music className="w-3 h-3" />
                                            GENERATE SOUND
                                        </>
                                    )}
                                </button>

                                {batchAudioUrl && (
                                    <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-indigo-500/30">
                                        <button
                                            onClick={handlePlaySound}
                                            className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors flex-shrink-0"
                                            type="button"
                                            title={isPlayingSound ? 'Pause' : 'Play'}
                                        >
                                            {isPlayingSound ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[8px] font-bold text-indigo-400 uppercase truncate">2 second vignette</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setBatchAudioUrl(null);
                                                if (audioRef.current) {
                                                    audioRef.current.removeAttribute('src');
                                                    audioRef.current.load();
                                                }
                                                setIsPlayingSound(false);
                                            }}
                                            className="p-1 text-slate-500 hover:text-red-500 transition-colors flex-shrink-0"
                                            type="button"
                                            title="Remove sound"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Activation Methods - Separate Section */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-1">
                                <Target className="w-3 h-3" /> ACTIVATION METHODS
                            </label>
                            <div className="space-y-2">
                                {/* GPS (Radius) */}
                                <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${
                                    activationTypes.includes('radius')
                                        ? 'bg-green-900/20 border-green-500/40'
                                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={activationTypes.includes('radius')}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setActivationTypes(prev => [...prev, 'radius']);
                                            } else {
                                                setActivationTypes(prev => prev.filter(t => t !== 'radius'));
                                            }
                                        }}
                                        className="w-3.5 h-3.5 rounded border-green-500 bg-slate-800 cursor-pointer accent-green-600"
                                    />
                                    <MapPin className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">GPS (RADIUS)</span>
                                    <span className="text-[8px] text-slate-500 ml-auto">Location-based</span>
                                </label>

                                {/* Click to Open */}
                                <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${
                                    activationTypes.includes('click')
                                        ? 'bg-blue-900/20 border-blue-500/40'
                                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={activationTypes.includes('click')}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setActivationTypes(prev => [...prev, 'click']);
                                            } else {
                                                setActivationTypes(prev => prev.filter(t => t !== 'click'));
                                            }
                                        }}
                                        className="w-3.5 h-3.5 rounded border-blue-500 bg-slate-800 cursor-pointer accent-blue-600"
                                    />
                                    <MousePointerClick className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">CLICK TO OPEN</span>
                                    <span className="text-[8px] text-slate-500 ml-auto">Tap to activate</span>
                                </label>

                                {/* Scan QR */}
                                <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-colors ${
                                    activationTypes.includes('qr')
                                        ? 'bg-purple-900/20 border-purple-500/40'
                                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={activationTypes.includes('qr')}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setActivationTypes(prev => [...prev, 'qr']);
                                            } else {
                                                setActivationTypes(prev => prev.filter(t => t !== 'qr'));
                                            }
                                        }}
                                        className="w-3.5 h-3.5 rounded border-purple-500 bg-slate-800 cursor-pointer accent-purple-600"
                                    />
                                    <QrCode className="w-3.5 h-3.5 text-purple-400" />
                                    <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">SCAN QR</span>
                                    <span className="text-[8px] text-slate-500 ml-auto">QR code scan</span>
                                </label>
                            </div>
                            {destinationType === 'MAP' && (
                                <p className="text-[8px] text-green-400/70 mt-2 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> GPS is always enabled for map-based tasks
                                </p>
                            )}
                            {activationTypes.length === 0 && (
                                <p className="text-[8px] text-yellow-400 mt-2">
                                    Select at least one activation method
                                </p>
                            )}
                        </div>

                        {/* Hidden audio element for preview */}
                        <audio
                            ref={audioRef}
                            src={batchAudioUrl ?? undefined}
                            onEnded={() => setIsPlayingSound(false)}
                            className="hidden"
                        />

                        {/* Generate / Generate More buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleGenerate(false)}
                                disabled={!topic.trim() || isGenerating}
                                className={`flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:grayscale text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg shadow-purple-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 ${approvedTasks.length > 0 ? 'flex-[2]' : ''}`}
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {isGenerating ? 'GENERATING...' : approvedTasks.length > 0 ? 'NEW BATCH' : 'GENERATE TASKS'}
                            </button>
                            {approvedTasks.length > 0 && (
                                <button
                                    onClick={() => handleGenerate(true)}
                                    disabled={!topic.trim() || isGenerating}
                                    className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:grayscale text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    {taskCount}
                                </button>
                            )}
                        </div>

                        {/* Progress Bar with Task Count */}
                        {isGenerating && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                                    <span>Generating task {currentTaskCount}/{totalTaskCount}</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div className="bg-purple-500 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Warning for stale cached data */}
                        {!isGenerating && (generatedBuffer.length > 0 || approvedTasks.length > 0) && !batchFinished && (
                            <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl">
                                <div className="flex items-start gap-3 mb-2">
                                    <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs text-yellow-300 font-bold leading-tight mb-1">OLD CACHED TASKS DETECTED</p>
                                        <p className="text-[10px] text-yellow-400/70 leading-tight">
                                            These tasks may have duplicate IDs. Clear them and regenerate with the new fix.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClearAll}
                                    className="w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-300 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2"
                                >
                                    <X className="w-3 h-3" /> CLEAR ALL TASKS
                                </button>
                            </div>
                        )}

                        {error && !error.includes("logo") && (
                            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-300 leading-tight">{error}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Results & Review */}
                <div className="flex-1 flex flex-col bg-[#0f172a] relative">
                    {/* Header for Results */}
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setResultsTab('REVIEW')}
                                className={`text-xs font-black uppercase pb-1 border-b-2 transition-colors ${
                                    resultsTab === 'REVIEW'
                                        ? 'text-purple-400 border-purple-500'
                                        : 'text-slate-500 border-transparent hover:text-white'
                                }`}
                                type="button"
                            >
                                REVIEW ({generatedBuffer.length})
                            </button>
                            <button
                                onClick={() => setResultsTab('APPROVED')}
                                className={`text-xs font-black uppercase pb-1 border-b-2 transition-colors ${
                                    resultsTab === 'APPROVED'
                                        ? 'text-purple-400 border-purple-500'
                                        : 'text-slate-500 border-transparent hover:text-white'
                                }`}
                                type="button"
                            >
                                APPROVED ({approvedTasks.length})
                            </button>
                        </div>
                        {resultsTab === 'REVIEW' && generatedBuffer.length > 0 && (
                            <button
                                onClick={handleApproveAll}
                                className="text-[10px] font-bold text-green-500 uppercase tracking-wider hover:text-green-400 flex items-center gap-1"
                                type="button"
                            >
                                <Check className="w-3 h-3" /> APPROVE ALL
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {resultsTab === 'REVIEW' && (
                            <>
                                {isGenerating ? (
                                    <div className="h-full flex flex-col items-center justify-center">
                                        <div className="relative mb-6">
                                            <div className="w-24 h-24 rounded-full border-4 border-purple-500/20 flex items-center justify-center">
                                                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                                            </div>
                                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black px-3 py-1 rounded-full">
                                                {Math.round(progress)}%
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">GENERATING TASKS</h3>
                                        <p className="text-sm text-purple-400 font-bold mb-6">
                                            Creating task {currentTaskCount} of {totalTaskCount}...
                                        </p>
                                        <div className="w-64 bg-slate-800 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-purple-600 to-purple-400 h-full transition-all duration-300 ease-out"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-4 uppercase font-bold tracking-wider">
                                            Using Claude AI + Stability AI
                                        </p>
                                    </div>
                                ) : generatedBuffer.length === 0 && approvedTasks.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                        <Wand2 className="w-16 h-16 mb-4" />
                                        <p className="text-sm font-black uppercase tracking-widest">READY TO GENERATE</p>
                                    </div>
                                ) : generatedBuffer.length === 0 ? (
                                    <div className="text-center py-10">
                                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                                            <Check className="w-8 h-8 text-green-500" />
                                        </div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-1">{approvedTasks.length} TASKS APPROVED</h3>
                                        <p className="text-xs text-slate-500 uppercase font-bold">SWITCH TO APPROVED TAB TO REVIEW</p>
                                    </div>
                                ) : (
                                    generatedBuffer.map((task, idx) => {
                                        const Icon = ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default;
                                        return (
                                            <div key={getUniqueTaskKey(task.id, idx)} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex gap-4 group hover:border-purple-500/50 transition-colors animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards" style={{ animationDelay: `${idx * 50}ms` }}>
                                                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
                                                    {task.task.imageUrl ? (
                                                        <img src={task.task.imageUrl} className="w-full h-full object-cover rounded-xl" />
                                                    ) : (
                                                        <Icon className="w-6 h-6 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className="font-bold text-white text-sm uppercase truncate">{task.title}</h4>
                                                        <span className="text-[9px] font-black bg-slate-900 text-slate-400 px-2 py-0.5 rounded uppercase">{task.task.type}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-2">{task.task.question}</p>

                                                    {/* Answers Preview - All Types */}
                                                    <div className="flex flex-wrap gap-1 mb-1">
                                                        {/* Multiple Choice / Checkbox / Dropdown - show options */}
                                                        {(task.task.type === 'multiple_choice' || task.task.type === 'checkbox' || task.task.type === 'dropdown') && task.task.options?.map(o => {
                                                            const isCorrect = task.task.correctAnswers?.includes(o) || o === task.task.answer;
                                                            return (
                                                                <span key={o} className={`text-[9px] px-1.5 py-0.5 rounded border ${isCorrect ? 'bg-green-900/40 border-green-500/50 text-green-400 font-bold' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                                                    {isCorrect && '✓ '}{o}
                                                                </span>
                                                            );
                                                        })}

                                                        {/* Boolean - show YES/NO in task language */}
                                                        {task.task.type === 'boolean' && (() => {
                                                            const lang = task.settings?.language?.toLowerCase() || '';
                                                            const yesLabel = lang.includes('danish') || lang.includes('dansk') ? 'JA' :
                                                                            lang.includes('german') || lang.includes('deutsch') ? 'JA' :
                                                                            lang.includes('spanish') || lang.includes('español') ? 'SÍ' :
                                                                            lang.includes('french') || lang.includes('français') ? 'OUI' :
                                                                            lang.includes('swedish') || lang.includes('svenska') ? 'JA' :
                                                                            lang.includes('norwegian') || lang.includes('norsk') ? 'JA' :
                                                                            lang.includes('dutch') || lang.includes('nederlands') ? 'JA' : 'YES';
                                                            const noLabel = lang.includes('danish') || lang.includes('dansk') ? 'NEJ' :
                                                                           lang.includes('german') || lang.includes('deutsch') ? 'NEIN' :
                                                                           lang.includes('spanish') || lang.includes('español') ? 'NO' :
                                                                           lang.includes('french') || lang.includes('français') ? 'NON' :
                                                                           lang.includes('swedish') || lang.includes('svenska') ? 'NEJ' :
                                                                           lang.includes('norwegian') || lang.includes('norsk') ? 'NEI' :
                                                                           lang.includes('dutch') || lang.includes('nederlands') ? 'NEE' : 'NO';
                                                            return (
                                                                <>
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${task.task.answer === 'YES' ? 'bg-green-900/40 border-green-500/50 text-green-400 font-bold' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                                                        {task.task.answer === 'YES' && '✓ '}{yesLabel}
                                                                    </span>
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${task.task.answer === 'NO' ? 'bg-green-900/40 border-green-500/50 text-green-400 font-bold' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                                                        {task.task.answer === 'NO' && '✓ '}{noLabel}
                                                                    </span>
                                                                </>
                                                            );
                                                        })()}

                                                        {/* Text - show correct answer */}
                                                        {task.task.type === 'text' && task.task.answer && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded border bg-green-900/40 border-green-500/50 text-green-400 font-bold">
                                                                ✓ {task.task.answer}
                                                            </span>
                                                        )}

                                                        {/* Slider - show range and correct value */}
                                                        {task.task.type === 'slider' && task.task.range && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded border bg-green-900/40 border-green-500/50 text-green-400 font-bold">
                                                                ✓ {task.task.range.correctValue} ({task.task.range.min}-{task.task.range.max})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 shrink-0">
                                                    <button onClick={() => handleApproveTask(task)} className="p-2 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white rounded-lg transition-colors" title="Approve" type="button">
                                                        <ThumbsUp className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDiscardTask(task.id)} className="p-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors" title="Discard" type="button">
                                                        <ThumbsDown className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </>
                        )}

                        {resultsTab === 'APPROVED' && (
                            <>
                                {approvedTasks.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                        <Check className="w-16 h-16 mb-4" />
                                        <p className="text-sm font-black uppercase tracking-widest">NO APPROVED TASKS</p>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-2">APPROVE TASKS IN THE REVIEW TAB</p>
                                    </div>
                                ) : (
                                    approvedTasks.map((task, idx) => {
                                        const Icon = ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default;
                                        return (
                                            <div key={getUniqueTaskKey(task.id, idx)} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex gap-4 group hover:border-green-500/40 transition-colors animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards" style={{ animationDelay: `${idx * 40}ms` }}>
                                                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
                                                    {task.task.imageUrl ? (
                                                        <img src={task.task.imageUrl} className="w-full h-full object-cover rounded-xl" />
                                                    ) : (
                                                        <Icon className="w-6 h-6 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className="font-bold text-white text-sm uppercase truncate">{task.title}</h4>
                                                        <span className="text-[9px] font-black bg-slate-900 text-slate-400 px-2 py-0.5 rounded uppercase">{task.task.type}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-2">{task.task.question}</p>

                                                    {/* Answers Preview - All Types */}
                                                    <div className="flex flex-wrap gap-1 mb-1">
                                                        {(task.task.type === 'multiple_choice' || task.task.type === 'checkbox' || task.task.type === 'dropdown') && task.task.options?.map(o => {
                                                            const isCorrect = task.task.correctAnswers?.includes(o) || o === task.task.answer;
                                                            return (
                                                                <span key={o} className={`text-[9px] px-1.5 py-0.5 rounded border ${isCorrect ? 'bg-green-900/40 border-green-500/50 text-green-400 font-bold' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                                                    {isCorrect && '✓ '}{o}
                                                                </span>
                                                            );
                                                        })}
                                                        {task.task.type === 'boolean' && (() => {
                                                            const lang = task.settings?.language?.toLowerCase() || '';
                                                            const yesLabel = lang.includes('danish') || lang.includes('dansk') ? 'JA' :
                                                                            lang.includes('german') || lang.includes('deutsch') ? 'JA' :
                                                                            lang.includes('spanish') || lang.includes('español') ? 'SÍ' :
                                                                            lang.includes('french') || lang.includes('français') ? 'OUI' :
                                                                            lang.includes('swedish') || lang.includes('svenska') ? 'JA' :
                                                                            lang.includes('norwegian') || lang.includes('norsk') ? 'JA' :
                                                                            lang.includes('dutch') || lang.includes('nederlands') ? 'JA' : 'YES';
                                                            const noLabel = lang.includes('danish') || lang.includes('dansk') ? 'NEJ' :
                                                                           lang.includes('german') || lang.includes('deutsch') ? 'NEIN' :
                                                                           lang.includes('spanish') || lang.includes('español') ? 'NO' :
                                                                           lang.includes('french') || lang.includes('français') ? 'NON' :
                                                                           lang.includes('swedish') || lang.includes('svenska') ? 'NEJ' :
                                                                           lang.includes('norwegian') || lang.includes('norsk') ? 'NEI' :
                                                                           lang.includes('dutch') || lang.includes('nederlands') ? 'NEE' : 'NO';
                                                            return (
                                                                <>
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${task.task.answer === 'YES' ? 'bg-green-900/40 border-green-500/50 text-green-400 font-bold' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                                                        {task.task.answer === 'YES' && '✓ '}{yesLabel}
                                                                    </span>
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${task.task.answer === 'NO' ? 'bg-green-900/40 border-green-500/50 text-green-400 font-bold' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                                                        {task.task.answer === 'NO' && '✓ '}{noLabel}
                                                                    </span>
                                                                </>
                                                            );
                                                        })()}
                                                        {task.task.type === 'text' && task.task.answer && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded border bg-green-900/40 border-green-500/50 text-green-400 font-bold">
                                                                ✓ {task.task.answer}
                                                            </span>
                                                        )}
                                                        {task.task.type === 'slider' && task.task.range && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded border bg-green-900/40 border-green-500/50 text-green-400 font-bold">
                                                                ✓ {task.task.range.correctValue} ({task.task.range.min}-{task.task.range.max})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            setApprovedTasks(prev => prev.filter(t => t.id !== task.id));
                                                        }}
                                                        className="p-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                                                        title="Remove from approved"
                                                        type="button"
                                                    >
                                                        <ThumbsDown className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-slate-800 bg-slate-900 shrink-0">
                        {renderDestinationSelector()}
                        
                        <button 
                            onClick={handleSaveApproved}
                            disabled={approvedTasks.length === 0}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:grayscale text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Save className="w-5 h-5" /> SAVE {approvedTasks.length} TASKS
                        </button>
                    </div>
                </div>

            </div>

            {/* Gemini API Key Modal */}
            <GeminiApiKeyModal
                isOpen={showGeminiKeyModal}
                onClose={() => setShowGeminiKeyModal(false)}
                onSave={handleApiKeySaved}
            />
        </div>
    </div>
  );
};

export default AiTaskGenerator;
