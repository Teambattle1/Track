
import React, { useState, useRef, useEffect } from 'react';
import { Wand2, X, Plus, Check, RefreshCw, ThumbsUp, ThumbsDown, Loader2, Sparkles, AlertCircle, Ban, Edit2, Globe, Tag, Image as ImageIcon, Home, Search, Hash, Save, Library, Gamepad2, Map, LayoutGrid, ArrowRight, LayoutList } from 'lucide-react';
import { TaskTemplate, Playground, TaskList } from '../types';
import { generateAiTasks, generateAiImage, searchLogoUrl } from '../services/ai';
import { ICON_COMPONENTS } from '../utils/icons';

interface AiTaskGeneratorProps {
  onClose: () => void;
  onAddTasks: (tasks: TaskTemplate[], targetPlaygroundId?: string | null) => void;
  onAddToLibrary?: (tasks: TaskTemplate[]) => void;
  onAddTasksToList?: (listId: string, tasks: TaskTemplate[]) => void;
  playgrounds?: Playground[];
  taskLists?: TaskList[];
  initialPlaygroundId?: string | null;
  targetMode?: 'GAME' | 'LIBRARY' | 'LIST'; // New prop to control context
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

const AiTaskGenerator: React.FC<AiTaskGeneratorProps> = ({ onClose, onAddTasks, onAddToLibrary, onAddTasksToList, playgrounds = [], taskLists = [], initialPlaygroundId = null, targetMode = 'GAME' }) => {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [taskCount, setTaskCount] = useState(5);
  const [autoTag, setAutoTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedBuffer, setGeneratedBuffer] = useState<TaskTemplate[]>([]);
  const [approvedTasks, setApprovedTasks] = useState<TaskTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [useLogoForTasks, setUseLogoForTasks] = useState(false);

  const [batchFinished, setBatchFinished] = useState(false);
  
  // Destination State
  const [destinationType, setDestinationType] = useState<'MAP' | 'PLAYGROUND'>(initialPlaygroundId ? 'PLAYGROUND' : 'MAP');
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<string | null>(initialPlaygroundId || (playgrounds.length > 0 ? playgrounds[0].id : null));
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  // If mode is LIST or LIBRARY, default behavior adjustments
  useEffect(() => {
      if (targetMode === 'LIST' || targetMode === 'LIBRARY') {
          setSaveToLibrary(true); // Always true for these modes essentially
      }
  }, [targetMode]);

  const isActiveRef = useRef(false);
  const topicInputRef = useRef<HTMLTextAreaElement>(null);

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
          const thematicImage = await generateAiImage(topic, 'scavenger');
          if (thematicImage) {
              imageUrlToUse = thematicImage;
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
          }
      }, 400);

    } catch (err: any) {
      if (!isActiveRef.current) return;

      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      
      let msg = err.message || "Something went wrong generating tasks.";
      if (msg.includes("xhr") || msg.includes("fetch")) {
          msg = "Connection failed. Please check your internet connection.";
      } else if (msg.includes("timed out")) {
          msg = "The AI is taking a bit too long. Please try again with a simpler topic.";
      }
      setError(msg);
    }
  };

  const handleCancelGeneration = () => {
      isActiveRef.current = false;
      setIsGenerating(false);
      setProgress(0);
      setError(null);
      setBatchFinished(false);
  };

  const handleGenerateMore = async () => {
      setGeneratedBuffer([]); 
      await handleGenerate();
  };

  const handleChangeTopic = () => {
      setBatchFinished(false);
      setGeneratedBuffer([]);
      setLogoUrl(null); 
      if (topicInputRef.current) {
          topicInputRef.current.focus();
          topicInputRef.current.select();
      }
  };

  const handleApprove = (task: TaskTemplate) => {
    setApprovedTasks(prev => [...prev, task]);
    setGeneratedBuffer(prev => {
        const next = prev.filter(t => t.id !== task.id);
        if (next.length === 0) setBatchFinished(true);
        return next;
    });
  };

  const handleReject = (taskId: string) => {
    setGeneratedBuffer(prev => {
        const next = prev.filter(t => t.id !== taskId);
        if (next.length === 0) setBatchFinished(true);
        return next;
    });
  };

  const handleFinalize = () => {
      if (approvedTasks.length === 0) return;

      // Logic based on target mode
      if (targetMode === 'LIST') {
          // Parent handles list creation with these tasks
          onAddTasks(approvedTasks, null); 
      } else if (targetMode === 'LIBRARY') {
          // Just save to library
          if (onAddToLibrary) onAddToLibrary(approvedTasks);
      } else {
          // Default GAME Mode
          
          // 1. Add to Library if checked
          if (saveToLibrary && onAddToLibrary) {
              onAddToLibrary(approvedTasks);
          }

          // 2. Add to Task List if selected
          if (selectedTaskListId && onAddTasksToList) {
              onAddTasksToList(selectedTaskListId, approvedTasks);
          }

          // 3. Add to Game (Map or Playground)
          if (destinationType === 'PLAYGROUND' && selectedPlaygroundId) {
              onAddTasks(approvedTasks, selectedPlaygroundId);
          } else {
              onAddTasks(approvedTasks, null); // Null means Map
          }
      }

      onClose();
  };

  const stripHtml = (html: any) => typeof html === 'string' ? html.replace(/<[^>]*>?/gm, '') : '';

  return (
    <div className="fixed inset-0 z-[3600] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-orange-600 to-red-600 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
               <Home className="w-5 h-5" />
            </button>
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
               <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold uppercase tracking-wider">AI TASK GENERATOR</h2>
              <p className="text-xs text-orange-100 uppercase tracking-wide">
                  {targetMode === 'LIST' ? 'CREATING NEW TASK LIST' : (targetMode === 'LIBRARY' ? 'ADDING TO GLOBAL LIBRARY' : 'ADDING TO GAME')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            
            {/* Left Panel: Controls & Approved List */}
            <div className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-800 p-5 border-r border-gray-200 dark:border-gray-700 flex flex-col gap-4 overflow-y-auto">
                
                {/* Input Section */}
                <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">TOPIC / THEME</label>
                      <textarea 
                        ref={topicInputRef}
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. 'Danfoss Universe', 'Copenhagen History'..."
                        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm min-h-[80px] resize-none"
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleGenerate();
                            }
                        }}
                      />
                    </div>

                    {/* Logo Search Section */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> COMPANY / BRAND LOGO
                        </label>
                        {!logoUrl ? (
                            <button 
                                onClick={handleSearchLogo}
                                disabled={isGeneratingLogo || !topic.trim()}
                                className="w-full py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
                            >
                                {isGeneratingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                SEARCH LOGO ONLINE
                            </button>
                        ) : (
                            <div className="bg-white dark:bg-gray-700 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="relative h-24 w-full bg-gray-100 dark:bg-gray-800 rounded mb-2 flex items-center justify-center overflow-hidden">
                                    <img src={logoUrl} alt="Found Logo" className="h-full object-contain" />
                                    <button onClick={() => setLogoUrl(null)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={useLogoForTasks} 
                                        onChange={(e) => setUseLogoForTasks(e.target.checked)}
                                        className="rounded text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="uppercase font-bold tracking-wide">USE THIS LOGO FOR ALL TASKS</span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                                <Globe className="w-3 h-3" /> LANGUAGE
                            </label>
                            <select 
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            >
                                {LANGUAGES.map(lang => (
                                    <option key={lang} value={lang}>{lang}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                                <Hash className="w-3 h-3" /> COUNT
                            </label>
                            <input 
                                type="number"
                                min={1}
                                max={20}
                                value={taskCount}
                                onChange={(e) => setTaskCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div className="col-span-1">
                            <label className={`text-xs font-bold uppercase tracking-wider mb-1 block flex items-center gap-1 ${!autoTag ? 'text-red-500' : 'text-gray-500'}`}>
                                <Tag className="w-3 h-3" /> AUTO-TAG *
                            </label>
                            <input 
                                type="text" 
                                value={autoTag}
                                onChange={(e) => setAutoTag(e.target.value)}
                                placeholder="Required..."
                                className={`w-full p-2 rounded-lg border ${!autoTag ? 'border-red-300 dark:border-red-900' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none`}
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !topic.trim() || !autoTag.trim()}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-xl font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        GENERATE {taskCount} TASKS
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2 border border-red-200 dark:border-red-900/40">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Approved List */}
                <div className="flex-1 flex flex-col min-h-0 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">APPROVED ({approvedTasks.length})</label>
                        {approvedTasks.length > 0 && (
                            <button onClick={() => setApprovedTasks([])} className="text-[10px] text-red-500 hover:underline uppercase font-bold tracking-wide">CLEAR</button>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {approvedTasks.length === 0 && (
                            <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center p-4 italic uppercase tracking-wide">
                                APPROVED TASKS WILL APPEAR HERE.
                            </div>
                        )}
                        {approvedTasks.map((task, idx) => (
                            <div key={task.id} className="bg-white dark:bg-gray-700 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 flex items-start gap-2 group animate-in slide-in-from-left-2 fade-in">
                                <div className="text-green-500 mt-0.5"><Check className="w-4 h-4" /></div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-800 dark:text-gray-100 text-xs truncate">{task.title}</p>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{stripHtml(task.task.question)}</p>
                                </div>
                                <button 
                                    onClick={() => setApprovedTasks(prev => prev.filter(t => t.id !== task.id))}
                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* DESTINATION SETTINGS & FINISH */}
                {targetMode === 'GAME' && (
                    <div className="space-y-3 shrink-0 bg-gray-100 dark:bg-gray-750 p-3 rounded-xl border border-gray-200 dark:border-gray-600">
                        <div>
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-2">WHERE TO SAVE?</label>
                            <div className="flex gap-1 mb-2">
                                <button 
                                    onClick={() => setDestinationType('MAP')}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase flex flex-col items-center gap-1 border-2 ${destinationType === 'MAP' ? 'bg-white dark:bg-gray-800 border-orange-500 text-orange-600' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                >
                                    <Map className="w-4 h-4" /> GAME MAP
                                </button>
                                <button 
                                    onClick={() => setDestinationType('PLAYGROUND')}
                                    disabled={playgrounds.length === 0}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase flex flex-col items-center gap-1 border-2 ${destinationType === 'PLAYGROUND' ? 'bg-white dark:bg-gray-800 border-blue-500 text-blue-600' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" /> PLAYGROUND
                                </button>
                            </div>

                            {destinationType === 'PLAYGROUND' && playgrounds.length > 0 && (
                                <select 
                                    value={selectedPlaygroundId || ''}
                                    onChange={(e) => setSelectedPlaygroundId(e.target.value)}
                                    className="w-full p-2 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none mb-2"
                                >
                                    {playgrounds.map(pg => (
                                        <option key={pg.id} value={pg.id}>{pg.title}</option>
                                    ))}
                                </select>
                            )}

                            <div className="border-t border-gray-200 dark:border-gray-600 my-2 pt-2">
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">ADD TO TASK LIST</label>
                                <select 
                                    value={selectedTaskListId}
                                    onChange={(e) => setSelectedTaskListId(e.target.value)}
                                    className="w-full p-2 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none mb-2"
                                >
                                    <option value="">(None - Just add to Game)</option>
                                    {taskLists.map(list => (
                                        <option key={list.id} value={list.id}>{list.name}</option>
                                    ))}
                                </select>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer p-1">
                                <input 
                                    type="checkbox" 
                                    checked={saveToLibrary} 
                                    onChange={(e) => setSaveToLibrary(e.target.checked)}
                                    className="rounded text-orange-600 focus:ring-orange-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                />
                                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase">ALSO SAVE TO LIBRARY</span>
                            </label>
                        </div>

                        <button 
                            onClick={handleFinalize}
                            disabled={approvedTasks.length === 0}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black shadow-lg disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-xs"
                        >
                            <Save className="w-4 h-4" /> IMPORT {approvedTasks.length} TASKS
                        </button>
                    </div>
                )}

                {targetMode !== 'GAME' && (
                    <div className="shrink-0 p-3">
                        <button 
                            onClick={handleFinalize}
                            disabled={approvedTasks.length === 0}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black shadow-lg disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-xs"
                        >
                            <Save className="w-4 h-4" /> 
                            {targetMode === 'LIST' ? 'CREATE LIST WITH TASKS' : 'SAVE TO GLOBAL LIBRARY'}
                        </button>
                    </div>
                )}
            </div>

            {/* Right Panel: Proposals (same as before) */}
            <div className="w-full md:w-2/3 bg-white dark:bg-gray-900 p-5 flex flex-col h-full overflow-hidden relative">
                {isGenerating && (
                    <div className="absolute inset-0 z-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md flex flex-col items-center justify-center text-orange-600 animate-in fade-in duration-300">
                        <div className="w-64 space-y-4">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                <span>GENERATING...</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-orange-600 transition-all duration-300 ease-out rounded-full" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-center text-xs font-bold text-gray-600 dark:text-gray-300 animate-pulse uppercase tracking-widest leading-relaxed px-4">
                                {progress < 20 ? "INITIATING CREATIVE ENGINE..." : 
                                 progress < 50 ? "RESEARCHING TOPIC & CULTURE..." : 
                                 progress < 80 ? "DRAFTING QUESTIONS & MEDIA..." : 
                                 "PACKAGING GAME ASSETS..."}
                            </p>
                            
                            <div className="flex justify-center mt-4">
                                <button 
                                    onClick={handleCancelGeneration}
                                    className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-2 uppercase tracking-wide"
                                >
                                    <Ban className="w-3 h-3" /> CANCEL
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 uppercase tracking-wide">
                        GENERATED PROPOSALS 
                        {generatedBuffer.length > 0 && <span className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 px-2 py-0.5 rounded-full text-xs">{generatedBuffer.length}</span>}
                    </h3>
                    {generatedBuffer.length > 0 && (
                        <button 
                            onClick={handleGenerateMore}
                            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800 transition-colors uppercase tracking-wide"
                        >
                            <RefreshCw className="w-3 h-3" /> GENERATE {taskCount} NEW
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-20 space-y-4 custom-scrollbar">
                    {generatedBuffer.length === 0 && !isGenerating && (
                        batchFinished ? (
                             <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in zoom-in-95 duration-300">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400 shadow-sm">
                                    <Check className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 uppercase tracking-wide">ALL CAUGHT UP!</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm uppercase tracking-wide text-xs">
                                    YOU'VE REVIEWED ALL GENERATED TASKS. WHAT WOULD YOU LIKE TO DO NEXT?
                                </p>
                                
                                <div className="flex flex-col w-full max-w-xs gap-3">
                                    <button 
                                        onClick={handleGenerateMore}
                                        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] uppercase tracking-wide"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        GENERATE MORE TASKS
                                    </button>
                                    
                                    <button 
                                        onClick={handleChangeTopic}
                                        className="w-full py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2 uppercase tracking-wide"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        CHANGE TOPIC
                                    </button>

                                    {approvedTasks.length > 0 && (
                                        <div className="mt-4">
                                            <button 
                                                onClick={handleFinalize}
                                                className="w-full py-3 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/30 rounded-xl font-bold hover:bg-green-100 dark:hover:bg-green-900/30 flex items-center justify-center gap-2 uppercase tracking-wide text-[10px]"
                                            >
                                                <ArrowRight className="w-4 h-4" />
                                                FINISH & IMPORT
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 uppercase tracking-wide">
                                <Sparkles className="w-16 h-16 mb-4 text-orange-200 dark:text-orange-900" />
                                <p className="text-lg font-medium mb-1">READY TO CREATE.</p>
                                <p className="text-sm">ENTER A TOPIC ON THE LEFT TO START.</p>
                            </div>
                        )
                    )}

                    {generatedBuffer.map((task) => {
                        const Icon = ICON_COMPONENTS[task.iconId] || ICON_COMPONENTS.default;
                        return (
                            <div key={task.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0 overflow-hidden relative">
                                        {task.task.imageUrl ? (
                                            <img src={task.task.imageUrl} alt="AI" className="w-full h-full object-cover" />
                                        ) : (
                                            <Icon className="w-6 h-6" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-gray-800 dark:text-gray-100 text-lg">{task.title}</h4>
                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 uppercase px-2 py-0.5 rounded font-bold">{task.task.type}</span>
                                            {task.tags.map(tag => (
                                                <span key={tag} className="text-[10px] bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 px-1.5 rounded uppercase">{tag}</span>
                                            ))}
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{task.task.question}</p>
                                        
                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
                                            <span className="font-bold mr-1 uppercase">SOLUTION:</span>
                                            {task.task.options ? task.task.answer || task.task.correctAnswers?.join(', ') : task.task.answer || task.task.range?.correctValue}
                                            {task.task.options && (
                                                <div className="mt-1 opacity-70">
                                                    OPTIONS: {task.task.options.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <button 
                                        onClick={() => handleReject(task.id)}
                                        className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500 transition-colors flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide"
                                    >
                                        <ThumbsDown className="w-4 h-4" /> REJECT
                                    </button>
                                    <button 
                                        onClick={() => handleApprove(task)}
                                        className="flex-1 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide"
                                    >
                                        <ThumbsUp className="w-4 h-4" /> APPROVE
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AiTaskGenerator;
