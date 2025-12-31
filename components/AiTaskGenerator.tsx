import React, { useState, useRef, useEffect } from 'react';
import { Wand2, X, Plus, Check, RefreshCw, ThumbsUp, ThumbsDown, Loader2, Sparkles, AlertCircle, Ban, Edit2, Globe, Tag, Image as ImageIcon, Home, Search, Hash, Save, Library, Gamepad2, Map, LayoutGrid, ArrowRight, LayoutList, Settings2, Target, Circle, Palette, MapPin, Music, Play, Square } from 'lucide-react';
import { TaskTemplate, Playground, TaskList, IconId } from '../types';
import { generateAiTasks, generateAiImage, searchLogoUrl, generateMoodAudio } from '../services/ai';
import { ICON_COMPONENTS } from '../utils/icons';

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
  const [autoTag, setAutoTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedBuffer, setGeneratedBuffer] = useState<TaskTemplate[]>([]);
  const [approvedTasks, setApprovedTasks] = useState<TaskTemplate[]>([]);
  const [resultsTab, setResultsTab] = useState<'REVIEW' | 'APPROVED'>('REVIEW');
  const [error, setError] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [useLogoForTasks, setUseLogoForTasks] = useState(false);

  const [batchFinished, setBatchFinished] = useState(false);
  
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
  const [enableGpsForTasks, setEnableGpsForTasks] = useState<boolean>(true); // GPS (radius) enabled by default

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

  const handleGenerateSound = async () => {
      if (!topic.trim()) return;
      setIsGeneratingSound(true);
      setError(null);

      try {
          const url = await generateMoodAudio(topic);
          if (url) {
              setBatchAudioUrl(url);
          } else {
              setError("Could not generate audio for this topic. Try again.");
          }
      } catch (e) {
          setError("Error generating audio. Check API key or try again.");
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

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (!autoTag.trim()) {
        setError("Tag is required for filtering.");
        return;
    }
    
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setBatchFinished(false);
    setResultsTab('REVIEW');
    isActiveRef.current = true;
    
    const interval = setInterval(() => {
        setProgress(prev => {
            const increment = prev < 40 ? 5 : (prev < 70 ? 2 : (prev < 90 ? 1 : 0.5));
            const next = prev + increment;
            return next >= 98 ? 98 : next;
        });
    }, 400);
    
    try {
      const newTasks = await generateAiTasks(topic, taskCount, language, autoTag);
      
      if (!isActiveRef.current) {
          clearInterval(interval);
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

      clearInterval(interval);
      setProgress(100);
      
      setTimeout(() => {
          if (isActiveRef.current) {
              setGeneratedBuffer(newTasks);
              setIsGenerating(false);
              setProgress(0);
              setBatchFinished(true);
          }
      }, 500);

    } catch (err: any) {
        clearInterval(interval);
        if (isActiveRef.current) {
            setError(err.message || "Failed to generate tasks.");
            setIsGenerating(false);
            setProgress(0);
        }
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
      // Determine if GPS should be enabled (always true for MAP, configurable for PLAYGROUND/LIBRARY)
      const shouldEnableGps = destinationType === 'MAP' || enableGpsForTasks;

      const finalTasks = approvedTasks.map(t => ({
          ...t,
          iconId: batchIcon !== 'auto' ? batchIcon : t.iconId,
          points: batchPoints,
          activationTypes: shouldEnableGps ? ['radius'] : [], // GPS (radius) by default
          // We attach these as custom properties that onAddTasks in App.tsx will look for
          // Using casting to bypass strict TaskTemplate check for these transient props
          radiusMeters: batchRadius,
          areaColor: batchColor,
          openingAudioUrl: batchAudioUrl || undefined
      })) as TaskTemplate[];

      // 1. Add to Game (Map or Playground)
      if (targetMode === 'GAME') {
          if (destinationType === 'MAP') {
              onAddTasks(finalTasks, null);
          } else {
              // 'PLAYGROUND'
              // selectedPlaygroundId could be 'CREATE_NEW' or an ID
              onAddTasks(finalTasks, selectedPlaygroundId);
          }
      } 
      // 2. Add to Library
      else if (targetMode === 'LIBRARY' && onAddToLibrary) {
          onAddToLibrary(finalTasks);
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

      // Also save to library if checkbox checked (and we didn't just do it via LIBRARY mode)
      if (saveToLibrary && targetMode !== 'LIBRARY' && onAddToLibrary) {
          onAddToLibrary(finalTasks);
      }

      onClose();
  };

  const renderDestinationSelector = () => {
      if (targetMode === 'LIBRARY') {
          return (
              <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl mb-4 text-center">
                  <p className="text-purple-300 font-bold text-xs uppercase tracking-widest">SAVING TO GLOBAL LIBRARY</p>
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
    <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-[#0f172a] border border-slate-800 w-full max-w-5xl h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative">
            
            {/* Header */}
            <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                        <Wand2 className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                            AI TASK GENERATOR
                            <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">BETA</span>
                        </h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mt-1">POWERED BY GEMINI 3 FLASH</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                
                {/* Left Panel: Controls */}
                <div className="w-80 bg-slate-900/50 border-r border-slate-800 p-6 overflow-y-auto custom-scrollbar flex flex-col">
                    <div className="space-y-6">
                        {/* Topic Input */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">TOPIC / THEME</label>
                            <textarea 
                                ref={topicInputRef}
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g. Historical monuments in Copenhagen with fun facts..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm font-medium outline-none focus:border-purple-500 transition-colors h-24 resize-none"
                            />
                        </div>

                        {/* Branding / Logo Search */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center justify-between">
                                <span>BRANDING</span>
                                {isGeneratingLogo && <Loader2 className="w-3 h-3 animate-spin" />}
                            </label>
                            <div className="flex gap-2 mb-2">
                                <button 
                                    onClick={handleSearchLogo}
                                    disabled={!topic || isGeneratingLogo}
                                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold uppercase rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Search className="w-3 h-3" /> FIND LOGO
                                </button>
                            </div>
                            
                            {logoUrl && (
                                <div className="flex items-center gap-3 mt-3 bg-slate-900 p-2 rounded-lg border border-slate-700">
                                    <img src={logoUrl} className="w-8 h-8 object-contain bg-white rounded" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] text-green-400 font-bold uppercase truncate">LOGO FOUND</p>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="useLogo" 
                                                checked={useLogoForTasks} 
                                                onChange={(e) => setUseLogoForTasks(e.target.checked)}
                                                className="rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500 w-3 h-3"
                                            />
                                            <label htmlFor="useLogo" className="text-[9px] text-slate-300 font-bold uppercase cursor-pointer">USE AS TASK IMAGE</label>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {error && error.includes("logo") && (
                                <p className="text-[9px] text-red-400 mt-2 font-bold uppercase">{error}</p>
                            )}
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
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">TAG</label>
                                <input 
                                    type="text" 
                                    value={autoTag}
                                    onChange={(e) => setAutoTag(e.target.value)}
                                    placeholder="Auto-tag..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none focus:border-purple-500"
                                />
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
                                <div className="grid grid-cols-5 gap-1.5">
                                    <button 
                                        onClick={() => setBatchIcon('auto')}
                                        className={`aspect-square rounded border flex items-center justify-center transition-all ${batchIcon === 'auto' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                        title="AI Auto-Select"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                    </button>
                                    {Object.keys(ICON_COMPONENTS).slice(0, 4).map((iconKey) => {
                                        const Icon = ICON_COMPONENTS[iconKey as IconId];
                                        return (
                                            <button
                                                key={iconKey}
                                                onClick={() => setBatchIcon(iconKey as IconId)}
                                                className={`aspect-square rounded border flex items-center justify-center transition-all ${batchIcon === iconKey ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                            >
                                                <Icon className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                </div>
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

                            <div className="mt-4 pt-4 border-t border-slate-600">
                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1"><Music className="w-3 h-3" /> OPENING SOUND</label>
                                <div className="space-y-2">
                                    <button
                                        onClick={handleGenerateSound}
                                        disabled={!topic.trim() || isGeneratingSound}
                                        className={`w-full py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${
                                            isGeneratingSound
                                                ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                                                : batchAudioUrl
                                                ? 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 border border-indigo-600/40 hover:border-indigo-500'
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
                                                AUDIO READY
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
                                                <p className="text-[8px] font-bold text-indigo-400 uppercase truncate">2.5 second vignette</p>
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
                        </div>

                        {/* Hidden audio element for preview */}
                        <audio
                            ref={audioRef}
                            src={batchAudioUrl ?? undefined}
                            onEnded={() => setIsPlayingSound(false)}
                            className="hidden"
                        />

                        <button 
                            onClick={handleGenerate}
                            disabled={!topic || !autoTag || isGenerating}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:grayscale text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            {isGenerating ? 'GENERATING...' : 'GENERATE TASKS'}
                        </button>

                        {/* Progress Bar */}
                        {isGenerating && (
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div className="bg-purple-500 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
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
                                {generatedBuffer.length === 0 && approvedTasks.length === 0 ? (
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
                                            <div key={task.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex gap-4 group hover:border-purple-500/50 transition-colors animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards" style={{ animationDelay: `${idx * 50}ms` }}>
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

                                                    {/* Answers Preview */}
                                                    {task.task.type === 'multiple_choice' && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {task.task.options?.map(o => (
                                                                <span key={o} className={`text-[9px] px-1.5 py-0.5 rounded border ${o === task.task.answer ? 'bg-green-900/30 border-green-500/30 text-green-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                                                    {o}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
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
                                            <div key={task.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex gap-4 group hover:border-green-500/40 transition-colors animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards" style={{ animationDelay: `${idx * 40}ms` }}>
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
                                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{task.task.question}</p>
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
        </div>
    </div>
  );
};

export default AiTaskGenerator;
