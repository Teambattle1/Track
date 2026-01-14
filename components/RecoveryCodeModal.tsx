import React, { useState, useEffect } from 'react';
import { X, Smartphone, RefreshCw, Copy, Check, AlertCircle } from 'lucide-react';
import { teamSync } from '../services/teamSync';

interface RecoveryCodeModalProps {
    onClose: () => void;
}

const RecoveryCodeModal: React.FC<RecoveryCodeModalProps> = ({ onClose }) => {
    const [code, setCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check for existing code on mount
    useEffect(() => {
        const existingCode = teamSync.getCurrentRecoveryCode();
        if (existingCode) {
            setCode(existingCode);
        }
    }, []);

    const handleGenerateCode = async () => {
        setLoading(true);
        setError(null);

        try {
            const newCode = await teamSync.generateRecoveryCode();
            if (newCode) {
                setCode(newCode);
            } else {
                setError('Could not generate recovery code. Make sure you are connected to a game.');
            }
        } catch (e) {
            console.error('[Recovery] Generate error:', e);
            setError('Failed to generate recovery code.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = async () => {
        if (!code) return;

        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            // Fallback for mobile
            const textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const connectionInfo = teamSync.getConnectionInfo();

    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Smartphone className="w-6 h-6 text-white" />
                        <h2 className="text-lg font-black text-white uppercase tracking-wider">Recovery Code</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Connection Info */}
                    {connectionInfo.teamName && (
                        <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Connected As</div>
                            <div className="text-sm font-bold text-white">{connectionInfo.userName}</div>
                            <div className="text-xs text-slate-400">Team: {connectionInfo.teamName}</div>
                        </div>
                    )}

                    {/* Explanation */}
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                        If your phone battery dies or you need to switch devices, use this code to continue playing on a new device. Your progress and votes will be preserved.
                    </p>

                    {/* Code Display or Generate Button */}
                    {code ? (
                        <div className="space-y-4">
                            {/* Code Display */}
                            <div className="bg-slate-800 border-2 border-green-500/50 rounded-xl p-4 text-center">
                                <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-2">Your Recovery Code</div>
                                <div className="text-4xl font-black text-white tracking-[0.3em] font-mono">
                                    {code}
                                </div>
                            </div>

                            {/* Copy Button */}
                            <button
                                onClick={handleCopyCode}
                                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-500" />
                                        <span className="text-green-500">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        Copy Code
                                    </>
                                )}
                            </button>

                            {/* Regenerate Button */}
                            <button
                                onClick={handleGenerateCode}
                                disabled={loading}
                                className="w-full text-slate-500 hover:text-slate-300 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                Generate New Code
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {error && (
                                <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleGenerateCode}
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Smartphone className="w-4 h-4" />
                                        Generate Recovery Code
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-500/80 leading-relaxed">
                                This code expires in 24 hours. Write it down or take a screenshot before your phone dies.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecoveryCodeModal;
