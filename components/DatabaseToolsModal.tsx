import React, { useState } from 'react';
import { X, AlertTriangle, Database, Loader2 } from 'lucide-react';
import { fixDuplicatePlayzones } from '../utils/fixDuplicatePlayzones';

interface DatabaseToolsModalProps {
  onClose: () => void;
}

const DatabaseToolsModal: React.FC<DatabaseToolsModalProps> = ({ onClose }) => {
  const [isFixingPlayzones, setIsFixingPlayzones] = useState(false);
  const [playzoneFixResult, setPlayzoneFixResult] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-500"/> DATABASE TOOLS
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">MAINTENANCE • CLEANUP • OPTIMIZATION</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">

          {/* Fix Duplicate Playzones */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">FIX DUPLICATE PLAYZONES</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Game 174 Cleanup
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                              Removes duplicate playground IDs that cause "same key" errors when importing playzones. 
                              This fixes the issue where the same playzone was added multiple times to a game.
                          </p>
                      </div>
                  </div>
              </div>

              <div className="mt-4">
                  <button
                      type="button"
                      onClick={async () => {
                          if (!confirm('⚠️ This will permanently remove duplicate playzones from Game 174.\n\nAre you sure you want to continue?')) {
                              return;
                          }
                          
                          setIsFixingPlayzones(true);
                          setPlayzoneFixResult(null);
                          try {
                              console.log('[DatabaseTools] Starting duplicate playzone fix...');
                              const result = await fixDuplicatePlayzones('game-1766964495140');
                              
                              if (result.success) {
                                  if (result.removed && (result.removed.playgrounds > 0 || result.removed.tasks > 0)) {
                                      setPlayzoneFixResult(`✅ Success! Removed ${result.removed.playgrounds} duplicate playground(s) and ${result.removed.tasks} task(s). Final counts: ${result.final?.playgrounds || 0} playgrounds, ${result.final?.tasks || 0} tasks.`);
                                  } else {
                                      setPlayzoneFixResult(`✅ No duplicates found. Game is already clean! (${result.final?.playgrounds || 0} playgrounds, ${result.final?.tasks || 0} tasks)`);
                                  }
                              } else {
                                  setPlayzoneFixResult(`❌ Error: ${result.error || result.message || 'Unknown error'}`);
                              }
                          } catch (error: any) {
                              console.error('[DatabaseTools] Fix failed:', error);
                              setPlayzoneFixResult(`❌ Error: ${error.message || 'Unknown error'}`);
                          } finally {
                              setIsFixingPlayzones(false);
                          }
                      }}
                      disabled={isFixingPlayzones}
                      className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                      {isFixingPlayzones ? (
                          <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              FIXING...
                          </>
                      ) : (
                          <>
                              <AlertTriangle className="w-4 h-4" />
                              FIX GAME 174 DUPLICATES
                          </>
                      )}
                  </button>

                  {playzoneFixResult && (
                      <div className={`mt-3 p-3 rounded-xl border text-[10px] font-bold leading-relaxed ${
                          playzoneFixResult.startsWith('✅')
                              ? 'bg-green-500/10 border-green-500/20 text-green-400'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                          {playzoneFixResult}
                      </div>
                  )}
              </div>
          </div>

          {/* Future Tools Placeholder */}
          <div className="bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 opacity-50">
              <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                      <Database className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">MORE TOOLS COMING SOON</p>
                      <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                          Additional database maintenance and optimization tools will be added here.
                      </p>
                  </div>
              </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                ADMIN USE ONLY • BACKUP BEFORE RUNNING
            </p>
        </div>
      </div>
    </div>
  );
};

export default DatabaseToolsModal;
