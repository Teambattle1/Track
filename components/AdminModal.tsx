
import React, { useState } from 'react';
import { Game } from '../types';
import { X, Database, AlertTriangle, Terminal, Copy, Check, ExternalLink, CheckCircle } from 'lucide-react';

interface AdminModalProps {
  games: Game[]; 
  onClose: () => void;
  onDeleteGame: (id: string) => void; 
  initialShowSql?: boolean;
}

const AdminModal: React.FC<AdminModalProps> = ({ onClose, initialShowSql = false }) => {
  const [showSql, setShowSql] = useState(initialShowSql);
  const [copied, setCopied] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const sqlCode = `-- SYSTEM UPDATE SCRIPT
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

-- 4b. ATOMIC TASK COMPLETION (Prevents Double-Scoring)
CREATE OR REPLACE FUNCTION complete_task(p_team_id TEXT, p_point_id TEXT, p_score_delta INTEGER)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.teams
  SET score = score + p_score_delta,
      completed_point_ids = array_append(completed_point_ids, p_point_id)
  WHERE id = p_team_id
    AND NOT (completed_point_ids @> ARRAY[p_point_id]);
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

  const copyToClipboard = () => {
      navigator.clipboard.writeText(sqlCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-500"/> DATABASE TOOLS
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">SYSTEM MAINTENANCE & SQL</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
          
          <button 
            onClick={() => setShowSql(!showSql)}
            className="w-full p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex items-center justify-between text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition-all mb-4"
          >
              <div className="flex flex-col items-start">
                  <span className="text-sm font-bold uppercase flex items-center gap-2"><Terminal className="w-4 h-4" /> Setup Database Tables</span>
                  <span className="text-[10px] text-indigo-400/60 font-bold mt-1">RUN THIS TO FIX STORAGE & SCORES</span>
              </div>
              <span className="text-[10px] bg-indigo-500/20 px-2 py-1 rounded">{showSql ? 'HIDE SQL' : 'CLICK TO VIEW SQL'}</span>
          </button>

          {showSql && (
              <div className="bg-black rounded-xl p-4 border border-slate-700 mb-4 relative animate-in zoom-in-95">
                  {!setupComplete ? (
                      <>
                          <div className="flex flex-col gap-2 mb-4">
                              <div className="flex gap-2">
                                  <a 
                                      href="https://supabase.com/dashboard/project/yktaxljydisfjyqhbnja/sql/new?skip=true" 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex-1 py-3 bg-[#3ecf8e] hover:bg-[#34b27b] text-black font-black uppercase text-[10px] tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                                  >
                                      <ExternalLink className="w-3 h-3" /> OPEN SUPABASE SQL
                                  </a>
                                  <button 
                                      onClick={() => setSetupComplete(true)}
                                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-600"
                                  >
                                      <Check className="w-3 h-3" /> MARK AS DONE
                                  </button>
                              </div>
                              <p className="text-[9px] text-slate-500 text-center">
                                  Clicking "Mark as Done" will hide the code snippet.
                              </p>
                          </div>

                          <div className="relative">
                              <pre className="text-[10px] text-green-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-60 custom-scrollbar p-2 bg-[#0d1117] rounded-lg border border-white/10">
                                  {sqlCode}
                              </pre>
                              <button 
                                onClick={copyToClipboard}
                                className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600"
                                title="Copy SQL"
                              >
                                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                          </div>
                      </>
                  ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                          <CheckCircle className="w-12 h-12 mb-3 text-green-500" />
                          <p className="font-black uppercase tracking-widest text-xs text-white">SETUP SCRIPT COMPLETED</p>
                          <p className="text-[10px] uppercase mt-1">Code snippet has been hidden.</p>
                          <button 
                              onClick={() => setSetupComplete(false)} 
                              className="mt-4 text-[9px] font-bold underline text-slate-600 hover:text-slate-400 uppercase"
                          >
                              Show Code Again
                          </button>
                      </div>
                  )}
              </div>
          )}
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
