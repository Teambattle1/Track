import React, { useState } from 'react';
import { GamePoint, TaskTemplate } from '../types';
import { X, Wand2, Loader, Plus, CheckCircle } from 'lucide-react';
import { generateAiTasks } from '../services/ai';

interface AiTaskGeneratorModalProps {
    onClose: () => void;
    onAddTask: (task: TaskTemplate) => void;
    playgroundId?: string;
}

const AiTaskGeneratorModal: React.FC<AiTaskGeneratorModalProps> = ({ 
    onClose, 
    onAddTask,
    playgroundId 
}) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedTasks, setGeneratedTasks] = useState<TaskTemplate[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please describe the task you want to create');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedTasks([]);

        try {
            const tasks = await generateAiTasks(prompt, 3, 'English');
            setGeneratedTasks(tasks);
            if (tasks.length === 0) {
                setError('No tasks were generated. Please try a different description.');
            }
        } catch (err) {
            setError('Failed to generate tasks. Please check your API key and try again.');
            console.error('AI generation error:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddTask = (task: TaskTemplate) => {
        onAddTask(task);
        setPrompt('');
        setGeneratedTasks([]);
        setSelectedTaskId(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[5200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f172a] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-purple-600 to-purple-700 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <Wand2 className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-wider">AI TASK GENERATOR</h2>
                            <p className="text-[10px] text-purple-100 font-bold uppercase tracking-wider">Generate tasks with AI</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                    {/* Prompt Input */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            DESCRIBE YOUR TASK
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder='e.g., "Find 3 things that are red in the city" or "Take a photo with a dog"'
                            className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-purple-500 outline-none min-h-[80px] resize-none"
                        />
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className={`w-full py-3 rounded-lg font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all ${
                            isGenerating
                                ? 'bg-purple-600/50 text-purple-200 cursor-wait'
                                : prompt.trim()
                                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-purple-200 border-t-transparent rounded-full animate-spin" />
                                GENERATING...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4" />
                                GENERATE WITH AI
                            </>
                        )}
                    </button>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-600/20 border border-red-600/40 rounded-lg text-red-400 text-[10px] font-bold uppercase">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Generated Tasks */}
                    {generatedTasks.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    SELECT A TASK TO ADD
                                </label>
                            </div>

                            {generatedTasks.map((task) => (
                                <div
                                    key={task.id}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        selectedTaskId === task.id
                                            ? 'bg-purple-600/30 border-purple-500'
                                            : 'bg-slate-800/50 border-slate-700 hover:border-purple-500'
                                    }`}
                                    onClick={() => setSelectedTaskId(task.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-white mb-1">{task.title}</h3>
                                            <p className="text-[10px] text-slate-400 mb-2">{task.task.question}</p>
                                            <div className="flex flex-wrap gap-1">
                                                <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-[9px] font-bold rounded uppercase">
                                                    {task.task.type}
                                                </span>
                                                <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-[9px] font-bold rounded uppercase">
                                                    {task.points} pts
                                                </span>
                                            </div>
                                        </div>
                                        {selectedTaskId === task.id && (
                                            <div className="p-2 bg-purple-600 rounded-lg text-white">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Add Selected Task Button */}
                            {selectedTaskId && (
                                <button
                                    onClick={() => {
                                        const selectedTask = generatedTasks.find(t => t.id === selectedTaskId);
                                        if (selectedTask) {
                                            handleAddTask(selectedTask);
                                        }
                                    }}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    ADD SELECTED TASK TO ZONE
                                </button>
                            )}
                        </div>
                    )}

                    {/* Empty State */}
                    {!isGenerating && generatedTasks.length === 0 && !error && (
                        <div className="text-center py-8 opacity-50">
                            <Wand2 className="w-12 h-12 mx-auto mb-3 text-purple-400" />
                            <p className="text-sm font-bold text-slate-400 uppercase">No tasks generated yet</p>
                            <p className="text-[10px] text-slate-500 mt-1">Describe a task above and click Generate</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiTaskGeneratorModal;
