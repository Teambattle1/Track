import React, { useState, useRef } from 'react';
import { TaskTemplate } from '../types';
import { generateAiTasks, generateAiImage } from '../services/ai';
import { ICON_COMPONENTS } from '../utils/icons';
import { Wand2, X, Plus, Check, RefreshCw, ThumbsUp, ThumbsDown, Loader2, Sparkles, AlertCircle, Ban, Edit2, Globe, Tag } from 'lucide-react';

interface AiTaskGeneratorProps {
  onClose: () => void;
  onAddTasks: (tasks: TaskTemplate[]) => void;
}

const LANGUAGES = ['English', 'Danish (Dansk)', 'German (Deutsch)', 'Spanish (Español)', 'French (Français)'];

const AiTaskGenerator: React.FC<AiTaskGeneratorProps> = ({ onClose, onAddTasks }) => {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [autoTag, setAutoTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedBuffer, setGeneratedBuffer] = useState<TaskTemplate[]>([]);
  const [approvedTasks, setApprovedTasks] = useState<TaskTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Track if a batch was fully processed to show the "What's Next?" screen
  const [batchFinished, setBatchFinished] = useState(false);
  
  // Ref to track if component is still "interested" in the result
  const isActiveRef = useRef(false);
  const topicInputRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setBatchFinished(false);
    isActiveRef.current = true;
    
    // Simulate progress while waiting for API
    const interval = setInterval(() => {
        setProgress(prev => {
            // Slower progress as it gets higher to avoid reaching 100 before done
            const increment = prev < 50 ? 10 : (prev < 80 ? 5 : 1);
            const next = prev + increment;
            return next >= 95 ? 95 : next;
        });
    }, 200);
    
    try {
      // 1. Generate text content
      const newTasks = await generateAiTasks(topic, 10, language, autoTag);
      
      if (!isActiveRef.current) {
          clearInterval(interval);
          return;
      }

      // 2. Generate matching thematic image
      // We generate ONE image for the TOPIC to keep it fast.
      const thematicImage = await generateAiImage(topic);

      if (thematicImage && isActiveRef.current) {
          // Assign this image to all tasks
          newTasks.forEach(t => {
              t.task.imageUrl = thematicImage;
          });
      }

      clearInterval(interval);
      setProgress(100);
      
      // Brief delay to show 100% completion
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
          msg = "The AI is taking too long to respond. Please try again or use a simpler topic.";
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
      // Keep approved, discard current buffer (already empty if batchFinished), fetch 10 new
      setGeneratedBuffer([]); 
      await handleGenerate();
  };

  const handleChangeTopic = () => {
      setBatchFinished(false);
      setGeneratedBuffer([]);
      // Focus and select the input for easy editing
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

  const handleFinish = () => {
    onAddTasks(approvedTasks);
    onClose();
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

  return (
    <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-orange-600 to-red-600 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
               <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Task Generator</h2>
              <p className="text-xs text-orange-100">Powered by Google Gemini</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            
            {/* Left Panel: Controls & Approved List */}
            <div className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-800 p-5 border-r border-gray-200 dark:border-gray-700 flex flex-col gap-6 overflow-y-auto">
                
                {/* Input Section */}
                <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Topic / Theme</label>
                      <textarea 
                        ref={topicInputRef}
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. 'Historical monuments in Copenhagen', 'Math puzzles for kids'..."
                        className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm min-h-[80px] resize-none"
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleGenerate();
                            }
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                                <Globe className="w-3 h-3" /> Language
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
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                                <Tag className="w-3 h-3" /> Auto-Tag (Optional)
                            </label>
                            <input 
                                type="text"
                                value={autoTag}
                                onChange={(e) => setAutoTag(e.target.value)}
                                placeholder="e.g. 'hard-mode'"
                                className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !topic.trim()}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-xl font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Generate Tasks & Art
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Approved List */}
                <div className="flex-1 flex flex-col min-h-0 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Approved ({approvedTasks.length})</label>
                        {approvedTasks.length > 0 && (
                            <button onClick={() => setApprovedTasks([])} className="text-[10px] text-red-500 hover:underline">Clear</button>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {approvedTasks.length === 0 && (
                            <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center p-4 italic">
                                Approved tasks will appear here.
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

                {/* Main Action */}
                <button 
                    onClick={handleFinish}
                    disabled={approvedTasks.length === 0}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2 shrink-0"
                >
                    <Plus className="w-5 h-5" />
                    Add {approvedTasks.length} Tasks to Library
                </button>
            </div>

            {/* Right Panel: Proposals */}
            <div className="w-full md:w-2/3 bg-white dark:bg-gray-900 p-5 flex flex-col h-full overflow-hidden relative">
                
                {isGenerating && (
                    <div className="absolute inset-0 z-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md flex flex-col items-center justify-center text-orange-600 animate-in fade-in duration-300">
                        <div className="w-64 space-y-4">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                                <span>Generating...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-orange-600 transition-all duration-300 ease-out rounded-full" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-300 animate-pulse">
                                {progress < 30 ? "Analyzing topic..." : progress < 70 ? "Drafting questions & images..." : "Finalizing tasks..."}
                            </p>
                            
                            {/* Cancel Button */}
                            <div className="flex justify-center mt-4">
                                <button 
                                    onClick={handleCancelGeneration}
                                    className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-2"
                                >
                                    <Ban className="w-3 h-3" /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        Generated Proposals 
                        {generatedBuffer.length > 0 && <span className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 px-2 py-0.5 rounded-full text-xs">{generatedBuffer.length}</span>}
                    </h3>
                    {generatedBuffer.length > 0 && (
                        <button 
                            onClick={handleGenerateMore}
                            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800 transition-colors"
                        >
                            <RefreshCw className="w-3 h-3" /> Generate 10 New
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-20 space-y-4">
                    {/* EMPTY STATE */}
                    {generatedBuffer.length === 0 && !isGenerating && (
                        batchFinished ? (
                             <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in zoom-in-95 duration-300">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400 shadow-sm">
                                    <Check className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">All caught up!</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
                                    You've reviewed all generated tasks. What would you like to do next?
                                </p>
                                
                                <div className="flex flex-col w-full max-w-xs gap-3">
                                    <button 
                                        onClick={handleGenerateMore}
                                        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Generate more about this topic
                                    </button>
                                    
                                    <button 
                                        onClick={handleChangeTopic}
                                        className="w-full py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Change Topic
                                    </button>

                                    {approvedTasks.length > 0 && (
                                        <button 
                                            onClick={handleFinish}
                                            className="w-full py-3 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/30 rounded-xl font-bold hover:bg-green-100 dark:hover:bg-green-900/30 flex items-center justify-center gap-2 mt-4"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Finish & Add {approvedTasks.length} Tasks
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Sparkles className="w-16 h-16 mb-4 text-orange-200 dark:text-orange-900" />
                                <p className="text-lg font-medium mb-1">Ready to create.</p>
                                <p className="text-sm">Enter a topic on the left to start.</p>
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
                                                <span key={tag} className="text-[10px] bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 px-1.5 rounded">{tag}</span>
                                            ))}
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{task.task.question}</p>
                                        
                                        {/* Answer Preview */}
                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2 text-xs text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
                                            <span className="font-bold mr-1">Solution:</span>
                                            {task.task.options ? task.task.answer || task.task.correctAnswers?.join(', ') : task.task.answer || task.task.range?.correctValue}
                                            {task.task.options && (
                                                <div className="mt-1 opacity-70">
                                                    Options: {task.task.options.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <button 
                                        onClick={() => handleReject(task.id)}
                                        className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                    >
                                        <ThumbsDown className="w-4 h-4" /> Reject
                                    </button>
                                    <button 
                                        onClick={() => handleApprove(task)}
                                        className="flex-1 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                    >
                                        <ThumbsUp className="w-4 h-4" /> Approve
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