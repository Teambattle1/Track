import React, { useState, useEffect, useRef } from 'react';
import { TaskList, TaskTemplate, TaskType } from '../types';
import * as db from '../services/db';
import { uploadImage } from '../services/storage'; // IMPORTED
import { Upload, CheckCircle, Image as ImageIcon, Loader2, Send, ArrowRight, ArrowLeft, RefreshCw, AlertCircle, User, Plus } from 'lucide-react';

interface ClientSubmissionViewProps {
    token: string;
}

const ClientSubmissionView: React.FC<ClientSubmissionViewProps> = ({ token }) => {
    const [list, setList] = useState<TaskList | null>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<'WELCOME' | 'FORM' | 'REVIEW' | 'SUCCESS'>('WELCOME');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Contributor State
    const [submitterName, setSubmitterName] = useState('');

    // Task Form State
    const [title, setTitle] = useState('');
    const [question, setQuestion] = useState('');
    const [type, setType] = useState<TaskType>('text');
    const [options, setOptions] = useState<string[]>(['', '']); // Min 2 options for MC
    const [answer, setAnswer] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        db.fetchTaskListByToken(token).then(data => {
            setList(data);
            setLoading(false);
        });
    }, [token]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await uploadImage(file);
            if (url) setImage(url);
        }
    };

    const handleSubmit = async () => {
        if (!list) return;
        setIsSubmitting(true);

        const newTask: TaskTemplate = {
            id: `client-${Date.now()}`,
            title: title || 'Untitled Task',
            task: {
                question: question,
                type: type,
                options: (type === 'multiple_choice' || type === 'checkbox') ? options.filter(o => o.trim()) : undefined,
                answer: type === 'text' ? answer : (type === 'multiple_choice' ? options[correctAnswerIndex || 0] : undefined),
                imageUrl: image || undefined
            },
            iconId: 'default',
            tags: ['CLIENT'],
            points: 100,
            createdAt: Date.now(),
            settings: {
                language: 'English',
                showAnswerStatus: true,
                scoreDependsOnSpeed: false,
                showCorrectAnswerOnMiss: true
            },
            feedback: {
                correctMessage: "Correct!",
                showCorrectMessage: true,
                incorrectMessage: "Incorrect",
                showIncorrectMessage: true,
                hint: "",
                hintCost: 0
            },
            submissionStatus: 'pending',
            submitterName: submitterName || 'Anonymous',
            isNew: true
        };

        const success = await db.submitClientTask(list.id, newTask);
        setIsSubmitting(false);
        if (success) {
            setStep('SUCCESS');
        } else {
            alert("Failed to submit task. Please try again.");
        }
    };

    const handleReset = () => {
        // Clear form but keep submitter name
        setTitle('');
        setQuestion('');
        setAnswer('');
        setOptions(['', '']);
        setImage(null);
        setCorrectAnswerIndex(null);
        setStep('WELCOME');
    };

    // ... (Render logic mostly same as before) ...
    
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-orange-500" />
                <p className="text-xs font-bold uppercase tracking-widest">CONNECTING...</p>
            </div>
        );
    }

    if (!list) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col p-6 text-center">
                <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                <h1 className="text-xl font-black text-slate-800 uppercase tracking-wide mb-2">LINK INVALID</h1>
                <p className="text-sm text-slate-500">Please check the link and try again.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
            
            {/* Header / Sticky Top */}
            {step !== 'WELCOME' && (
                <div className="bg-slate-900 text-white p-4 shadow-xl sticky top-0 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {step === 'FORM' && (
                            <button onClick={() => setStep('WELCOME')} className="p-1 hover:bg-white/10 rounded-full mr-1">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Send className="w-4 h-4 text-orange-500" /> NEW TASK
                            </h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                BY: <span className="text-white">{submitterName}</span>
                            </p>
                        </div>
                    </div>
                    {step === 'FORM' && (
                        <div className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">
                            STEP 1/2
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col">
                
                {/* WELCOME SCREEN */}
                {step === 'WELCOME' && (
                    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300 my-auto justify-center">
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                            {/* List Image or Placeholder */}
                            <div className="h-40 bg-slate-100 relative">
                                {list.imageUrl ? (
                                    <img src={list.imageUrl} className="w-full h-full object-cover" alt="Task List Cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                                        <Send className="w-16 h-16 text-white/50" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4 text-white">
                                    <h2 className="text-2xl font-black uppercase tracking-wide leading-tight mb-1">{list.name}</h2>
                                    <p className="text-xs text-white/90 font-medium line-clamp-2">{list.description || "Help us create tasks for this game!"}</p>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-1">
                                        <User className="w-3 h-3" /> CONTRIBUTOR NAME
                                    </label>
                                    <input 
                                        type="text" 
                                        value={submitterName} 
                                        onChange={e => setSubmitterName(e.target.value)} 
                                        className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-orange-500 bg-slate-50 text-lg font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 text-center uppercase" 
                                        placeholder="YOUR NAME" 
                                    />
                                </div>

                                <button 
                                    onClick={() => setStep('FORM')}
                                    disabled={!submitterName.trim()}
                                    className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:grayscale text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <Plus className="w-5 h-5" /> CREATE TASK
                                </button>
                            </div>
                        </div>
                        <p className="text-center text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest">
                            POWERED BY TEAMACTION
                        </p>
                    </div>
                )}

                {/* SUCCESS SCREEN */}
                {step === 'SUCCESS' && (
                    <div className="flex flex-col h-full items-center justify-center animate-in zoom-in-95">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-wide mb-2 text-slate-900">TASK RECEIVED!</h2>
                        <p className="text-sm text-slate-500 mb-8 text-center max-w-xs">
                            Thanks <strong>{submitterName}</strong>! Your task has been sent to the Game Master for approval.
                        </p>
                        <button 
                            onClick={handleReset}
                            className="w-full max-w-xs py-4 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg"
                        >
                            <RefreshCw className="w-4 h-4" /> MAKE ANOTHER TASK
                        </button>
                    </div>
                )}

                {/* REVIEW SCREEN */}
                {step === 'REVIEW' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 pt-4">
                        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-center">
                            <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1">CONFIRMATION REQUIRED</p>
                            <p className="text-sm text-orange-900">Ready to submit this task?</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">TITLE</label>
                                <p className="font-bold text-lg text-slate-900">{title || "Untitled"}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">QUESTION</label>
                                <p className="text-sm text-slate-600 font-medium">{question}</p>
                            </div>
                            {image && (
                                <div className="rounded-lg overflow-hidden border border-slate-200">
                                    <img src={image} className="w-full h-48 object-cover" />
                                </div>
                            )}
                            <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                <label className="text-[9px] font-black text-green-600 uppercase tracking-widest block mb-1">SOLUTION</label>
                                <p className="font-bold text-green-700">
                                    {type === 'text' ? answer : options[correctAnswerIndex || 0]}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep('FORM')} className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold uppercase text-xs tracking-wide">
                                BACK
                            </button>
                            <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold uppercase text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                SUBMIT TASK
                            </button>
                        </div>
                    </div>
                )}

                {/* FORM SCREEN */}
                {step === 'FORM' && (
                    <div className="space-y-5 animate-in slide-in-from-left-4 pb-10">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">TASK TITLE</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-orange-500 outline-none font-bold text-slate-800" placeholder="e.g. Statue Mystery" />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">QUESTION / CHALLENGE</label>
                                <textarea value={question} onChange={e => setQuestion(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-orange-500 outline-none h-24 resize-none text-sm" placeholder="What is the color of..." />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">IMAGE (OPTIONAL)</label>
                                <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-50 cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all relative overflow-hidden group">
                                    {image ? (
                                        <>
                                            <img src={image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold uppercase">Change Image</div>
                                        </>
                                    ) : (
                                        <div className="text-center text-slate-400">
                                            <ImageIcon className="w-8 h-8 mx-auto mb-1 group-hover:text-orange-500 transition-colors"/><span className="text-[10px] font-bold uppercase">Tap to Upload</span>
                                        </div>
                                    )}
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">RESPONSE TYPE</label>
                                <div className="flex bg-slate-100 rounded-xl p-1">
                                    <button onClick={() => setType('text')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${type === 'text' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Text Answer</button>
                                    <button onClick={() => setType('multiple_choice')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${type === 'multiple_choice' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Quiz (MC)</button>
                                </div>
                            </div>

                            {type === 'text' ? (
                                <div className="animate-in fade-in">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">CORRECT ANSWER</label>
                                    <input type="text" value={answer} onChange={e => setAnswer(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:border-green-500 outline-none font-medium" placeholder="Exact answer..." />
                                </div>
                            ) : (
                                <div className="space-y-3 animate-in fade-in">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">OPTIONS (TAP CORRECT ONE)</label>
                                    {options.map((opt, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <button 
                                                onClick={() => setCorrectAnswerIndex(idx)}
                                                className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-colors shadow-sm ${correctAnswerIndex === idx ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'}`}
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                            </button>
                                            <input 
                                                type="text" 
                                                value={opt} 
                                                onChange={e => {
                                                    const newOpts = [...options];
                                                    newOpts[idx] = e.target.value;
                                                    setOptions(newOpts);
                                                }}
                                                className="flex-1 p-3 rounded-xl border border-slate-300 focus:border-orange-500 outline-none text-sm" 
                                                placeholder={`Option ${idx + 1}`} 
                                            />
                                        </div>
                                    ))}
                                    <button onClick={() => setOptions([...options, ''])} className="text-[10px] font-bold text-blue-500 uppercase hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-dashed border-blue-200 w-full">+ ADD OPTION</button>
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => setStep('REVIEW')} 
                            disabled={!title || !question || (type === 'text' && !answer) || (type === 'multiple_choice' && correctAnswerIndex === null)}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all"
                        >
                            REVIEW SUBMISSION <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientSubmissionView;
