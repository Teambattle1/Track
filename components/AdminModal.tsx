import React, { useEffect, useMemo, useState } from 'react';
import { Game } from '../types';
import { X, KeyRound, Eye, EyeOff, Trash2, Download, Book, Zap, Loader2, Check } from 'lucide-react';
import { generateFeatureCatalogPDF } from '../utils/pdfGenerator';
import { migrateAllTasksToGpsEnabled } from '../services/migrationGpsActivation';

interface AdminModalProps {
  games: Game[];
  onClose: () => void;
  onDeleteGame: (id: string) => void;
  initialShowSql?: boolean;
  onLibraryUpdated?: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ onClose, onLibraryUpdated }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [hasStoredGeminiKey, setHasStoredGeminiKey] = useState(false);

  const [isMigratingGps, setIsMigratingGps] = useState(false);
  const [gpsMigrationResult, setGpsMigrationResult] = useState<any | null>(null);

  useEffect(() => {
      try {
          const existing = localStorage.getItem('GEMINI_API_KEY');
          setHasStoredGeminiKey(!!existing);
      } catch {
          setHasStoredGeminiKey(false);
      }
  }, []);

  const geminiStatus = useMemo(() => {
      if (geminiSaved) return 'SAVED';
      return hasStoredGeminiKey ? 'KEY SET' : 'NOT SET';
  }, [geminiSaved, hasStoredGeminiKey]);

  // NOTE: Supabase setup SQL was moved to the SUPABASE module (System Tools).

  const sqlCode = '';

  /*
-- RUN THIS IN SUPABASE SQL EDITOR TO FIX STORAGE AND ATOMIC UPDATES

-- 1. ENABLE STORAGE FOR IMAGES
INSERT INTO storage.buckets (id, name, public) VALUES ('game-assets', 'game-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'game-assets');
CREATE POLICY "Public Reads" ON storage.objects FOR SELECT TO public USING (bucket_id = 'game-assets');

-- 2. GAMES Table
CREATE TABLE IF NOT EXISTS public.games (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public games access" ON public.games;
CREATE POLICY "Public games access" ON public.games FOR ALL USING (true) WITH CHECK (true);

-- 3. TEAMS Table
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    join_code TEXT,
    photo_url TEXT,
    members JSONB DEFAULT '[]'::jsonb, 
    score INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    captain_device_id TEXT,
    is_started BOOLEAN DEFAULT false,
    completed_point_ids TEXT[] DEFAULT '{}'
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public teams access" ON public.teams;
CREATE POLICY "Public teams access" ON public.teams FOR ALL USING (true) WITH CHECK (true);

-- 4. ATOMIC SCORE INCREMENT (Prevents Race Conditions)
CREATE OR REPLACE FUNCTION increment_score(team_id TEXT, amount INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.teams
  SET score = score + amount
  WHERE id = team_id;
END;
$$;

-- 5. SERVER TIME (Prevents Cheating)
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMP WITH TIME ZONE LANGUAGE plpgsql AS $$
BEGIN
  RETURN now();
END;
$$;

-- 6. LIBRARY & LISTS
CREATE TABLE IF NOT EXISTS public.library (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public library access" ON public.library;
CREATE POLICY "Public library access" ON public.library FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.task_lists (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public task_lists access" ON public.task_lists;
CREATE POLICY "Public task_lists access" ON public.task_lists FOR ALL USING (true) WITH CHECK (true);

-- 7. USERS
CREATE TABLE IF NOT EXISTS public.account_users (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.account_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public account_users access" ON public.account_users;
CREATE POLICY "Public account_users access" ON public.account_users FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.playground_library (
    id TEXT PRIMARY KEY,
    title TEXT,
    is_global BOOLEAN DEFAULT false,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.playground_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public playground library access" ON public.playground_library;
CREATE POLICY "Public playground library access" ON public.playground_library FOR ALL USING (true) WITH CHECK (true);

-- 8. REALTIME
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    END IF;
END $$;

NOTIFY pgrst, 'reload config';`;

  const copyToClipboard = async () => {
*/

  const copyToClipboard = async () => {
      // no-op (SQL moved to SUPABASE module)
      return;
  };

  const setupComplete = false;
  const showSql = false;
  const copied = false;

  const handleMigrateGpsActivation = async () => {
      try {
          // Try modern Clipboard API first
          if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(sqlCode);
          } else {
              throw new Error('Clipboard API not available');
          }
      } catch (error) {
          // Fallback to older execCommand method for restricted iframe contexts
          try {
              const textArea = document.createElement('textarea');
              textArea.value = sqlCode;
              textArea.style.position = 'fixed';
              textArea.style.left = '-999999px';
              textArea.style.top = '-999999px';
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              const successful = document.execCommand('copy');
              document.body.removeChild(textArea);

              if (!successful) {
                  throw new Error('execCommand copy failed');
              }
          } catch (fallbackError) {
              console.error('Failed to copy SQL to clipboard:', error, fallbackError);
              return;
          }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleMigrateGpsActivation = async () => {
      setIsMigratingGps(true);
      try {
          const result = await migrateAllTasksToGpsEnabled();
          setGpsMigrationResult(result);
          console.log('GPS Migration Result:', result);

          // Notify parent to reload the library
          if (onLibraryUpdated) {
              onLibraryUpdated();
          }
      } catch (error) {
          console.error('Migration failed:', error);
          setGpsMigrationResult({
              error: error instanceof Error ? error.message : 'Unknown error'
          });
      } finally {
          setIsMigratingGps(false);
      }
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
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">AI KEY • EXPORTS • MIGRATIONS</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">

          {/* AI Settings */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                          <KeyRound className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">AI (GEMINI) API KEY</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Status: <span className={geminiStatus === 'NOT SET' ? 'text-red-400' : 'text-green-400'}>{geminiStatus}</span>
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                              Stored locally in this browser so AI task generation works in deployed mode.
                          </p>
                      </div>
                  </div>
              </div>

              <div className="mt-4 flex gap-2">
                  <div className="flex-1 relative">
                      <input
                          type={showGeminiKey ? 'text' : 'password'}
                          value={geminiKey}
                          onChange={(e) => {
                              setGeminiKey(e.target.value);
                              setGeminiSaved(false);
                          }}
                          placeholder="Paste Gemini API key"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-xs text-white font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                          type="button"
                          onClick={() => setShowGeminiKey(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title={showGeminiKey ? 'Hide key' : 'Show key'}
                      >
                          {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                  </div>

                  <button
                      type="button"
                      onClick={() => {
                          const next = geminiKey.trim();
                          if (!next) return;
                          try {
                              localStorage.setItem('GEMINI_API_KEY', next);
                              setHasStoredGeminiKey(true);
                              setGeminiSaved(true);
                              setGeminiKey('');
                              setTimeout(() => setGeminiSaved(false), 2000);
                          } catch {
                              // ignore
                          }
                      }}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors"
                  >
                      <Check className="w-4 h-4 inline-block mr-1" /> SAVE
                  </button>

                  <button
                      type="button"
                      onClick={() => {
                          try {
                              localStorage.removeItem('GEMINI_API_KEY');
                          } catch {
                              // ignore
                          }
                          setHasStoredGeminiKey(false);
                          setGeminiSaved(false);
                          setGeminiKey('');
                      }}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors border border-slate-700"
                      title="Clear stored key"
                  >
                      <Trash2 className="w-4 h-4" />
                  </button>
              </div>
          </div>


          {/* Feature Catalog Export */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                          <Book className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">FEATURE CATALOG</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Download PDF for users
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                              Professional feature documentation with all app capabilities for new users
                          </p>
                      </div>
                  </div>
              </div>

              <button
                  onClick={async () => {
                      setIsGeneratingPDF(true);
                      try {
                          await generateFeatureCatalogPDF();
                      } catch (error) {
                          console.error('Error generating PDF:', error);
                          alert('Failed to generate PDF. Check console for details.');
                      } finally {
                          setIsGeneratingPDF(false);
                      }
                  }}
                  disabled={isGeneratingPDF}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                  {isGeneratingPDF ? (
                      <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          GENERATING...
                      </>
                  ) : (
                      <>
                          <Download className="w-4 h-4" />
                          DOWNLOAD PDF
                      </>
                  )}
              </button>
          </div>

          {/* GPS Activation Migration */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">GPS ACTIVATION MIGRATION</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                              Enable GPS for all tasks
                          </p>
                          <p className="text-[10px] text-slate-600 font-bold mt-2 leading-snug">
                              Ensures all tasks in the database have GPS (radius) activation enabled by default.
                          </p>
                      </div>
                  </div>
              </div>

              {gpsMigrationResult ? (
                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-700 space-y-2">
                      {gpsMigrationResult.error ? (
                          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-2">
                              <p className="text-[10px] text-red-300 font-bold">❌ Migration Error:</p>
                              <p className="text-[9px] text-red-400 mt-1">{gpsMigrationResult.error}</p>
                          </div>
                      ) : (
                          <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-2 space-y-1">
                              <p className="text-[10px] text-green-300 font-bold">✓ Migration Completed!</p>
                              <p className="text-[9px] text-green-400">Total Tasks: {gpsMigrationResult.total}</p>
                              <p className="text-[9px] text-green-400">Updated: {gpsMigrationResult.updated}</p>
                              <p className="text-[9px] text-green-400">Already Had GPS: {gpsMigrationResult.alreadyHasGps}</p>
                              {gpsMigrationResult.failed > 0 && (
                                  <p className="text-[9px] text-yellow-400">Failed: {gpsMigrationResult.failed}</p>
                              )}
                          </div>
                      )}
                      <button
                          onClick={() => setGpsMigrationResult(null)}
                          className="w-full mt-2 text-[9px] font-bold text-slate-400 hover:text-white uppercase py-1.5 bg-slate-800/50 rounded hover:bg-slate-700/50 transition-colors"
                      >
                          CLEAR RESULTS
                      </button>
                  </div>
              ) : (
                  <button
                      onClick={handleMigrateGpsActivation}
                      disabled={isMigratingGps}
                      className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-600/50 disabled:cursor-not-allowed text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                      {isMigratingGps ? (
                          <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              MIGRATING...
                          </>
                      ) : (
                          <>
                              <Zap className="w-4 h-4" />
                              RUN GPS MIGRATION
                          </>
                      )}
                  </button>
              )}
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
