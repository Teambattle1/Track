import React, { useEffect, useMemo, useState } from 'react';
import { Game } from '../types';
import { X, KeyRound, Eye, EyeOff, Trash2, Check, Sparkles, Play, Loader2, CheckCircle, XCircle, Palette } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

interface AdminModalProps {
  games: Game[];
  onClose: () => void;
  onDeleteGame: (id: string) => void;
  initialShowSql?: boolean;
  onLibraryUpdated?: () => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
  // Claude (Anthropic) key state
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [anthropicSaved, setAnthropicSaved] = useState(false);
  const [hasStoredAnthropicKey, setHasStoredAnthropicKey] = useState(false);
  const [claudeTestStatus, setClaudeTestStatus] = useState<TestStatus>('idle');
  const [claudeTestResult, setClaudeTestResult] = useState<string>('');

  // Stability AI key state
  const [stabilityKey, setStabilityKey] = useState('');
  const [showStabilityKey, setShowStabilityKey] = useState(false);
  const [stabilitySaved, setStabilitySaved] = useState(false);
  const [hasStoredStabilityKey, setHasStoredStabilityKey] = useState(false);
  const [stabilityTestStatus, setStabilityTestStatus] = useState<TestStatus>('idle');
  const [stabilityTestResult, setStabilityTestResult] = useState<string>('');

  useEffect(() => {
      try {
          const existingAnthropic = localStorage.getItem('ANTHROPIC_API_KEY');
          setHasStoredAnthropicKey(!!existingAnthropic);

          const existingStability = localStorage.getItem('STABILITY_API_KEY');
          setHasStoredStabilityKey(!!existingStability);
      } catch {
          setHasStoredAnthropicKey(false);
          setHasStoredStabilityKey(false);
      }
  }, []);

  const anthropicStatus = useMemo(() => {
      if (anthropicSaved) return 'SAVED';
      return hasStoredAnthropicKey ? 'KEY SET' : 'NOT SET';
  }, [anthropicSaved, hasStoredAnthropicKey]);

  const stabilityStatus = useMemo(() => {
      if (stabilitySaved) return 'SAVED';
      return hasStoredStabilityKey ? 'KEY SET' : 'NOT SET';
  }, [stabilitySaved, hasStoredStabilityKey]);

  // Test Claude API
  const testClaudeApi = async () => {
    const key = localStorage.getItem('ANTHROPIC_API_KEY');
    if (!key) {
      setClaudeTestStatus('error');
      setClaudeTestResult('No API key stored');
      return;
    }

    setClaudeTestStatus('testing');
    setClaudeTestResult('');

    try {
      const anthropic = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: 'Create one simple scavenger hunt task about finding something blue. Reply with just the task title and question in JSON format: {"title": "...", "question": "..."}'
        }],
      });

      const textContent = response.content.find(c => c.type === 'text');
      const responseText = textContent?.type === 'text' ? textContent.text : '';

      // Try to parse the JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const task = JSON.parse(jsonMatch[0]);
        setClaudeTestStatus('success');
        setClaudeTestResult(`Task: "${task.title || 'Generated'}"`);
      } else {
        setClaudeTestStatus('success');
        setClaudeTestResult('Response received');
      }
    } catch (error: any) {
      setClaudeTestStatus('error');
      setClaudeTestResult(error.message?.substring(0, 50) || 'API error');
    }
  };

  // Test Stability AI API
  const testStabilityApi = async () => {
    const key = localStorage.getItem('STABILITY_API_KEY');
    if (!key) {
      setStabilityTestStatus('error');
      setStabilityTestResult('No API key stored');
      return;
    }

    setStabilityTestStatus('testing');
    setStabilityTestResult('');

    try {
      // Just test the API key by checking account balance
      const response = await fetch('https://api.stability.ai/v1/user/balance', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setStabilityTestStatus('success');
      setStabilityTestResult(`Credits: ${data.credits?.toFixed(2) || 'OK'}`);
    } catch (error: any) {
      setStabilityTestStatus('error');
      setStabilityTestResult(error.message?.substring(0, 50) || 'API error');
    }
  };

  const TestStatusIndicator = ({ status, result }: { status: TestStatus; result: string }) => {
    if (status === 'idle') return null;

    return (
      <div className={`mt-3 p-2 rounded-lg flex items-center gap-2 text-[10px] font-bold ${
        status === 'testing' ? 'bg-yellow-500/20 text-yellow-400' :
        status === 'success' ? 'bg-green-500/20 text-green-400' :
        'bg-red-500/20 text-red-400'
      }`}>
        {status === 'testing' && <Loader2 className="w-3 h-3 animate-spin" />}
        {status === 'success' && <CheckCircle className="w-3 h-3" />}
        {status === 'error' && <XCircle className="w-3 h-3" />}
        <span className="uppercase tracking-wider">
          {status === 'testing' ? 'Testing...' : result}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-500"/> AI SETTINGS
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">API KEY MANAGEMENT</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">

          {/* Claude (Anthropic) API Key */}
          <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">CLAUDE (ANTHROPIC) API KEY</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Status: <span className={anthropicStatus === 'NOT SET' ? 'text-red-400' : 'text-green-400'}>{anthropicStatus}</span>
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                              Used for <span className="text-purple-400">task generation</span> and <span className="text-purple-400">translations</span>.
                          </p>
                      </div>
                  </div>
              </div>

              <div className="mt-4 flex gap-2">
                  <div className="flex-1 relative">
                      <input
                          type={showAnthropicKey ? 'text' : 'password'}
                          value={anthropicKey}
                          onChange={(e) => {
                              setAnthropicKey(e.target.value);
                              setAnthropicSaved(false);
                          }}
                          placeholder="sk-ant-..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-xs text-white font-mono outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                      />
                      <button
                          type="button"
                          onClick={() => setShowAnthropicKey(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title={showAnthropicKey ? 'Hide key' : 'Show key'}
                      >
                          {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                  </div>

                  <button
                      type="button"
                      onClick={() => {
                          const next = anthropicKey.trim();
                          if (!next) return;
                          try {
                              localStorage.setItem('ANTHROPIC_API_KEY', next);
                              setHasStoredAnthropicKey(true);
                              setAnthropicSaved(true);
                              setAnthropicKey('');
                              setClaudeTestStatus('idle');
                              setTimeout(() => setAnthropicSaved(false), 2000);
                          } catch {
                              // ignore
                          }
                      }}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors"
                  >
                      <Check className="w-4 h-4 inline-block mr-1" /> SAVE
                  </button>

                  <button
                      type="button"
                      onClick={() => {
                          try {
                              localStorage.removeItem('ANTHROPIC_API_KEY');
                          } catch {
                              // ignore
                          }
                          setHasStoredAnthropicKey(false);
                          setAnthropicSaved(false);
                          setAnthropicKey('');
                          setClaudeTestStatus('idle');
                      }}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors border border-slate-700"
                      title="Clear stored key"
                  >
                      <Trash2 className="w-4 h-4" />
                  </button>
              </div>

              {/* Test Button for Claude */}
              {hasStoredAnthropicKey && (
                <button
                    type="button"
                    onClick={testClaudeApi}
                    disabled={claudeTestStatus === 'testing'}
                    className="mt-3 w-full px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-50 text-purple-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2 border border-purple-500/30"
                >
                    {claudeTestStatus === 'testing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    TEST CLAUDE API
                </button>
              )}

              <TestStatusIndicator status={claudeTestStatus} result={claudeTestResult} />

              <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-colors"
              >
                  → Get API key from console.anthropic.com
              </a>
          </div>

          {/* Stability AI API Key */}
          <div className="bg-slate-950 border border-orange-500/30 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                          <Palette className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">STABILITY AI API KEY</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Status: <span className={stabilityStatus === 'NOT SET' ? 'text-red-400' : 'text-green-400'}>{stabilityStatus}</span>
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                              Used for <span className="text-orange-400">AI image generation</span> (~$0.002/image).
                          </p>
                      </div>
                  </div>
              </div>

              <div className="mt-4 flex gap-2">
                  <div className="flex-1 relative">
                      <input
                          type={showStabilityKey ? 'text' : 'password'}
                          value={stabilityKey}
                          onChange={(e) => {
                              setStabilityKey(e.target.value);
                              setStabilitySaved(false);
                          }}
                          placeholder="sk-..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-xs text-white font-mono outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                      <button
                          type="button"
                          onClick={() => setShowStabilityKey(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title={showStabilityKey ? 'Hide key' : 'Show key'}
                      >
                          {showStabilityKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                  </div>

                  <button
                      type="button"
                      onClick={() => {
                          const next = stabilityKey.trim();
                          if (!next) return;
                          try {
                              localStorage.setItem('STABILITY_API_KEY', next);
                              setHasStoredStabilityKey(true);
                              setStabilitySaved(true);
                              setStabilityKey('');
                              setStabilityTestStatus('idle');
                              setTimeout(() => setStabilitySaved(false), 2000);
                          } catch {
                              // ignore
                          }
                      }}
                      className="px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors"
                  >
                      <Check className="w-4 h-4 inline-block mr-1" /> SAVE
                  </button>

                  <button
                      type="button"
                      onClick={() => {
                          try {
                              localStorage.removeItem('STABILITY_API_KEY');
                          } catch {
                              // ignore
                          }
                          setHasStoredStabilityKey(false);
                          setStabilitySaved(false);
                          setStabilityKey('');
                          setStabilityTestStatus('idle');
                      }}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors border border-slate-700"
                      title="Clear stored key"
                  >
                      <Trash2 className="w-4 h-4" />
                  </button>
              </div>

              {/* Test Button for Stability AI */}
              {hasStoredStabilityKey && (
                <button
                    type="button"
                    onClick={testStabilityApi}
                    disabled={stabilityTestStatus === 'testing'}
                    className="mt-3 w-full px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 text-orange-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2 border border-orange-500/30"
                >
                    {stabilityTestStatus === 'testing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    TEST STABILITY API
                </button>
              )}

              <TestStatusIndicator status={stabilityTestStatus} result={stabilityTestResult} />

              <a
                  href="https://platform.stability.ai/account/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-[10px] text-orange-400 hover:text-orange-300 font-bold transition-colors"
              >
                  → Get API key from platform.stability.ai
              </a>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                ADMIN USE ONLY
            </p>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
