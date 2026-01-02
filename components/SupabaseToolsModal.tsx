import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, CheckCircle, XCircle, RefreshCw, ExternalLink, Terminal, Copy, Check } from 'lucide-react';
import { testDatabaseConnection } from '../services/db';

interface SupabaseToolsModalProps {
  onClose: () => void;
}

// SQL code constant - shared between component and helper function
const SQL_CODE = `-- SYSTEM UPDATE SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR TO FIX STORAGE AND ATOMIC UPDATES

-- 1. ENABLE STORAGE FOR IMAGES
INSERT INTO storage.buckets (id, name, public) VALUES ('game-assets', 'game-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('map-style-previews', 'map-style-previews', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public Reads" ON storage.objects;

CREATE POLICY "Public Uploads" ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id IN ('game-assets', 'map-style-previews'));

CREATE POLICY "Public Reads" ON storage.objects FOR SELECT TO public
USING (bucket_id IN ('game-assets', 'map-style-previews'));

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

-- 8. TEAM LOCATION TRACKING (for Team History Map & Impossible Travel Detection)
CREATE TABLE IF NOT EXISTS public.team_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    accuracy DECIMAL(6, 2),
    speed DECIMAL(6, 2), -- meters per second
    is_impossible_travel BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.team_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public team_locations access" ON public.team_locations;
CREATE POLICY "Public team_locations access" ON public.team_locations FOR ALL USING (true) WITH CHECK (true);

-- Index for fast queries by team and game
CREATE INDEX IF NOT EXISTS idx_team_locations_team_game ON public.team_locations(team_id, game_id, timestamp DESC);

-- 9. TASK ATTEMPTS (for Team History Map)
CREATE TABLE IF NOT EXISTS public.task_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    task_title TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('CORRECT', 'WRONG', 'SUBMITTED')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    answer JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.task_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public task_attempts access" ON public.task_attempts;
CREATE POLICY "Public task_attempts access" ON public.task_attempts FOR ALL USING (true) WITH CHECK (true);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_task_attempts_team_game ON public.task_attempts(team_id, game_id, timestamp DESC);

-- 10. IMPOSSIBLE TRAVEL DETECTION FUNCTION
CREATE OR REPLACE FUNCTION detect_impossible_travel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    prev_location RECORD;
    distance_meters DECIMAL;
    time_diff_seconds DECIMAL;
    calculated_speed DECIMAL;
    max_walking_speed DECIMAL := 2.5; -- 2.5 m/s ≈ 9 km/h (fast walk/jog)
BEGIN
    -- Get previous location for this team
    SELECT latitude, longitude, timestamp, speed
    INTO prev_location
    FROM public.team_locations
    WHERE team_id = NEW.team_id AND game_id = NEW.game_id AND id != NEW.id
    ORDER BY timestamp DESC
    LIMIT 1;

    IF prev_location IS NOT NULL THEN
        -- Calculate distance using Haversine formula (approximate)
        distance_meters := 6371000 * acos(
            cos(radians(prev_location.latitude)) *
            cos(radians(NEW.latitude)) *
            cos(radians(NEW.longitude) - radians(prev_location.longitude)) +
            sin(radians(prev_location.latitude)) *
            sin(radians(NEW.latitude))
        );

        -- Calculate time difference in seconds
        time_diff_seconds := EXTRACT(EPOCH FROM (NEW.timestamp - prev_location.timestamp));

        -- Calculate speed (m/s)
        IF time_diff_seconds > 0 THEN
            calculated_speed := distance_meters / time_diff_seconds;
            NEW.speed := calculated_speed;

            -- Flag if speed exceeds maximum walking speed
            IF calculated_speed > max_walking_speed THEN
                NEW.is_impossible_travel := true;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger to automatically detect impossible travel
DROP TRIGGER IF EXISTS trigger_detect_impossible_travel ON public.team_locations;
CREATE TRIGGER trigger_detect_impossible_travel
    BEFORE INSERT ON public.team_locations
    FOR EACH ROW
    EXECUTE FUNCTION detect_impossible_travel();

-- 11. REALTIME
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    END IF;

    -- Enable realtime for team locations (for live tracking)
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_locations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.team_locations;
    END IF;

    -- Enable realtime for media submissions (for live approval feed)
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'media_submissions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.media_submissions;
    END IF;
END $$;

-- 9. MEDIA SUBMISSIONS (for Live Approval of Photo/Video Tasks)
CREATE TABLE IF NOT EXISTS public.media_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    point_id TEXT NOT NULL,
    point_title TEXT NOT NULL,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
    submitted_at BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at BIGINT,
    review_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.media_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public media_submissions access" ON public.media_submissions;
CREATE POLICY "Public media_submissions access" ON public.media_submissions FOR ALL USING (true) WITH CHECK (true);

-- Index for fast queries by game and status
CREATE INDEX IF NOT EXISTS idx_media_submissions_game_status ON public.media_submissions(game_id, status);

NOTIFY pgrst, 'reload config';`;

const SupabaseToolsModal: React.FC<SupabaseToolsModalProps> = ({ onClose }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string; latency?: number } | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // Generate a simple hash from the SQL code to detect changes
  const sqlCodeHash = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < SQL_CODE.length; i++) {
      const char = SQL_CODE.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }, []);

  useEffect(() => {
    const url = localStorage.getItem('SUPABASE_URL') ||
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://yktaxljydisfjyqhbnja.supabase.co';

    const key = localStorage.getItem('SUPABASE_ANON_KEY') ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdGF4bGp5ZGlzZmp5cWhibmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzQ2ODYsImV4cCI6MjA4MTcxMDY4Nn0.XeTW4vHGbEm6C7U94zMLsZiDB80cyvuqYbSRNX8oyQI';

    setSupabaseUrl(url);
    setSupabaseKey(key.substring(0, 20) + '...');

    // Check if the current SQL code has been marked as done
    const completedHash = localStorage.getItem('supabase_setup_completed_hash');
    setSetupComplete(completedHash === sqlCodeHash);

    runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlCodeHash]);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    const testResult = await testDatabaseConnection();
    setResult(testResult);
    setTesting(false);
  };

  const updateSupabaseConfig = () => {
    const newUrl = prompt('Enter your Supabase URL:', supabaseUrl);
    if (newUrl) {
      localStorage.setItem('SUPABASE_URL', newUrl);
      const newKey = prompt('Enter your Supabase Anon Key:');
      if (newKey) {
        localStorage.setItem('SUPABASE_ANON_KEY', newKey);
        alert('✅ Configuration updated! Refreshing page...');
        window.location.reload();
      }
    }
  };

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(SQL_CODE);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (error) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = SQL_CODE;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!successful) throw new Error('execCommand copy failed');
      } catch (fallbackError) {
        console.error('Failed to copy SQL to clipboard:', error, fallbackError);
        return;
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const healthTitle = useMemo(() => {
    if (!result) return 'SUPABASE';
    return result.success ? 'SUPABASE' : 'SUPABASE (ISSUE DETECTED)';
  }, [result]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-red-900/30 to-orange-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">{healthTitle}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Configuration */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-black text-slate-400 uppercase mb-3">Current Configuration</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between gap-6">
                <span className="text-slate-500">Supabase URL:</span>
                <span className="text-white truncate">{supabaseUrl}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-slate-500">Anon Key:</span>
                <span className="text-slate-400">{supabaseKey}</span>
              </div>
            </div>
          </div>

          {/* Connection Test */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-400 uppercase">Connection Test</h3>
              <button
                onClick={runTest}
                disabled={testing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg font-bold text-xs uppercase flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'TESTING...' : 'TEST CONNECTION'}
              </button>
            </div>

            {result && (
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.success ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-bold text-green-400">CONNECTION SUCCESSFUL</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-sm font-bold text-red-400">CONNECTION FAILED</span>
                    </>
                  )}
                </div>
                {result.latency && (
                  <p className="text-xs text-slate-400">Latency: {result.latency}ms</p>
                )}
                {result.error && (
                  <p className="text-xs text-red-300 mt-2 font-mono">{result.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Issue Detected */}
          {result && !result.success && (
            <div className="bg-red-900/20 border border-red-600/50 rounded-xl p-4">
              <h3 className="text-sm font-black text-red-400 uppercase mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Issue Detected
              </h3>
              <div className="space-y-2 text-xs text-red-200">
                <p className="font-bold">Your Supabase project appears to be:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Deleted or removed</li>
                  <li>Paused (free tier projects pause after inactivity)</li>
                  <li>Misconfigured credentials</li>
                  <li>Temporarily unavailable</li>
                </ul>
              </div>
            </div>
          )}

          {/* Solutions */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-black text-slate-400 uppercase mb-3">Solutions</h3>
            <div className="space-y-3">
              <button
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Supabase Dashboard
              </button>

              <button
                onClick={updateSupabaseConfig}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
              >
                Update Supabase Credentials
              </button>

              <button
                onClick={() => {
                  if (confirm('This will clear all local data and use demo mode. Continue?')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
              >
                Reset to Demo Mode
              </button>
            </div>
          </div>

          {/* Setup Database Tables (moved from Database) */}
          <button
            onClick={() => setShowSql(v => !v)}
            className="w-full p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex items-center justify-between text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition-all"
          >
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold uppercase flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Setup Database Tables
              </span>
              <span className="text-[10px] text-indigo-400/60 font-bold mt-1">RUN THIS TO FIX STORAGE & SCORES</span>
            </div>
            <span className="text-[10px] bg-indigo-500/20 px-2 py-1 rounded">{showSql ? 'HIDE SQL' : 'SHOW SQL'}</span>
          </button>

          {showSql && (
            <div className="bg-black rounded-xl p-4 border border-slate-700 relative animate-in zoom-in-95">
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
                        <ExternalLink className="w-3 h-3" /> Open Supabase SQL
                      </a>
                      <button
                        onClick={() => {
                          // Save the hash of the current SQL code to localStorage
                          localStorage.setItem('supabase_setup_completed_hash', sqlCodeHash);
                          setSetupComplete(true);
                          setShowSql(false); // Close the SQL panel
                        }}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-600"
                      >
                        <Check className="w-3 h-3" /> Mark as Done
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-500 text-center">
                      Clicking "Mark as Done" will hide the code snippet.
                    </p>
                  </div>

                  <div className="relative">
                    <pre className="text-[10px] text-green-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-60 custom-scrollbar p-2 bg-[#0d1117] rounded-lg border border-white/10">
                      {SQL_CODE}
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
                    onClick={() => {
                      setSetupComplete(false);
                      // Clear the stored hash to allow showing new code
                      localStorage.removeItem('supabase_setup_completed_hash');
                    }}
                    className="mt-4 text-[9px] font-bold underline text-slate-600 hover:text-slate-400 uppercase"
                  >
                    Show Code Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupabaseToolsModal;

// Helper function to check if there's new Supabase setup code that hasn't been marked as done
export const hasNewSupabaseSetup = (): boolean => {
  // Generate hash from the module-level SQL_CODE constant
  let hash = 0;
  for (let i = 0; i < SQL_CODE.length; i++) {
    const char = SQL_CODE.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const sqlCodeHash = hash.toString();

  // Check if the current code matches the completed hash
  const completedHash = localStorage.getItem('supabase_setup_completed_hash');
  return completedHash !== sqlCodeHash;
};
