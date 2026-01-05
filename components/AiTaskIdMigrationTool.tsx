import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, Loader2, Database, Zap } from 'lucide-react';
import { fixDuplicateAiTaskIds, previewAiTaskIdMigration } from '../utils/fixDuplicateAiTaskIds';

interface AiTaskIdMigrationToolProps {
  onClose: () => void;
}

const AiTaskIdMigrationTool: React.FC<AiTaskIdMigrationToolProps> = ({ onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [scanResult, setScanResult] = useState<{
    gamesAffected: number;
    tasksToFix: number;
    preview: Array<{ gameId: string; gameName: string; tasksWithOldIds: number }>;
  } | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    gamesScanned: number;
    gamesUpdated: number;
    tasksFixed: number;
  } | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    setMigrationResult(null);

    try {
      const result = await previewAiTaskIdMigration();
      setScanResult(result);
    } catch (error) {
      console.error('Scan failed:', error);
      alert('❌ Scan failed. Check console for details.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleMigrate = async () => {
    if (!scanResult || scanResult.tasksToFix === 0) return;

    const confirmed = window.confirm(
      `⚠️ DATABASE MIGRATION\n\n` +
      `This will update ${scanResult.tasksToFix} AI tasks across ${scanResult.gamesAffected} games.\n\n` +
      `Old task IDs will be replaced with new unique IDs.\n\n` +
      `This action cannot be undone. Continue?`
    );

    if (!confirmed) return;

    setIsMigrating(true);

    try {
      const result = await fixDuplicateAiTaskIds();
      setMigrationResult(result);
      alert(
        `✅ MIGRATION COMPLETE!\n\n` +
        `Games scanned: ${result.gamesScanned}\n` +
        `Games updated: ${result.gamesUpdated}\n` +
        `Tasks fixed: ${result.tasksFixed}\n\n` +
        `Please hard refresh your browser (Ctrl+Shift+R) to see the changes.`
      );
    } catch (error) {
      console.error('Migration failed:', error);
      alert('❌ Migration failed. Check console for details.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                <Database className="w-6 h-6 text-orange-400" />
                AI TASK ID MIGRATION
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                Fix duplicate React key errors
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Problem Description */}
          <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-orange-300 uppercase tracking-wider mb-2">
                  DUPLICATE KEY ERRORS
                </h3>
                <p className="text-xs text-orange-200/80 leading-relaxed">
                  Old AI tasks created before the fix have IDs like <code className="bg-black/30 px-1 rounded">ai-1767644047664-0</code>
                  which can cause duplicate React key warnings. This tool will scan your database and automatically
                  regenerate all old AI task IDs with the new unique format.
                </p>
              </div>
            </div>
          </div>

          {/* Scan Results */}
          {scanResult && !migrationResult && (
            <div className="p-4 bg-slate-800 border border-slate-600 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                SCAN COMPLETE
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-2xl font-black text-blue-400">{scanResult.gamesAffected}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Games Affected</div>
                </div>
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-2xl font-black text-orange-400">{scanResult.tasksToFix}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Tasks to Fix</div>
                </div>
                <div className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-2xl font-black text-green-400">
                    {scanResult.tasksToFix === 0 ? '✓' : '!'}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Status</div>
                </div>
              </div>

              {scanResult.preview.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Affected Games:</p>
                  {scanResult.preview.map((item) => (
                    <div
                      key={item.gameId}
                      className="text-xs text-slate-300 py-1 px-2 bg-slate-900/30 rounded mb-1"
                    >
                      <span className="font-bold">{item.gameName}</span> - {item.tasksWithOldIds} tasks
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Migration Results */}
          {migrationResult && (
            <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-green-300 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                MIGRATION COMPLETE
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-black text-green-400">{migrationResult.gamesScanned}</div>
                  <div className="text-[10px] font-bold text-green-200/60 uppercase mt-1">Games Scanned</div>
                </div>
                <div className="text-center p-3 bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-black text-green-400">{migrationResult.gamesUpdated}</div>
                  <div className="text-[10px] font-bold text-green-200/60 uppercase mt-1">Games Updated</div>
                </div>
                <div className="text-center p-3 bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-black text-green-400">{migrationResult.tasksFixed}</div>
                  <div className="text-[10px] font-bold text-green-200/60 uppercase mt-1">Tasks Fixed</div>
                </div>
              </div>

              <p className="text-xs text-green-200/80 text-center mt-3">
                ✅ All duplicate AI task IDs have been updated! Hard refresh (Ctrl+Shift+R) to see changes.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleScan}
              disabled={isScanning || isMigrating}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
              type="button"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  SCANNING...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {scanResult ? 'RESCAN' : 'SCAN DATABASE'}
                </>
              )}
            </button>

            <button
              onClick={handleMigrate}
              disabled={!scanResult || scanResult.tasksToFix === 0 || isMigrating || isScanning}
              className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
              type="button"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  MIGRATING...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  FIX {scanResult?.tasksToFix || 0} TASKS
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              📋 INSTRUCTIONS:
            </p>
            <ol className="text-xs text-slate-300 space-y-1 ml-4 list-decimal">
              <li>Click <strong>"SCAN DATABASE"</strong> to find old AI tasks</li>
              <li>Review the scan results</li>
              <li>Click <strong>"FIX TASKS"</strong> to update all IDs automatically</li>
              <li>Hard refresh your browser (Ctrl+Shift+R) after migration</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiTaskIdMigrationTool;
