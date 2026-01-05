import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, Check, Database, ChevronRight, AlertTriangle, CheckCircle, XCircle, RefreshCw, ExternalLink, Terminal, Settings } from 'lucide-react';
import { testDatabaseConnection } from '../services/db';

interface SupabaseScriptsModalProps {
  onClose: () => void;
}

interface SQLScript {
  id: string;
  title: string;
  description: string;
  category: 'setup' | 'migrations' | 'utilities';
  sql: string;
  createdDate: string;
}

// Main setup SQL script
const SETUP_SQL = `-- SYSTEM UPDATE SCRIPT
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

-- 12. MEDIA SUBMISSIONS (for Live Approval of Photo/Video Tasks)
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

const SQL_SCRIPTS: SQLScript[] = [
  {
    id: 'database_setup',
    title: 'Database Setup (Main)',
    description: 'Complete database setup including all tables, storage, RLS policies, and functions. Run this first!',
    category: 'setup',
    createdDate: '2024-12-01',
    sql: SETUP_SQL
  },
  {
    id: 'game_location_history',
    title: 'Game Location History',
    description: 'Stores historic team location paths for replay and analysis',
    category: 'migrations',
    createdDate: '2025-01-05',
    sql: `-- Migration: Game Location History Table
-- Description: Stores historic team location paths for replay and analysis
-- Created: 2025-01-05

-- Create game_location_history table
CREATE TABLE IF NOT EXISTS game_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL UNIQUE,
    team_paths JSONB NOT NULL DEFAULT '{}',
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on game_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_game_location_history_game_id ON game_location_history(game_id);

-- Create index on updated_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_game_location_history_updated_at ON game_location_history(updated_at);

-- Enable Row Level Security
ALTER TABLE game_location_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read and write
CREATE POLICY "Allow authenticated users to read game location history"
    ON game_location_history
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert game location history"
    ON game_location_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update game location history"
    ON game_location_history
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_game_location_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before updates
CREATE TRIGGER update_game_location_history_timestamp
    BEFORE UPDATE ON game_location_history
    FOR EACH ROW
    EXECUTE FUNCTION update_game_location_history_updated_at();

-- Add comment to table
COMMENT ON TABLE game_location_history IS 'Stores historic team location paths for games to enable path replay and analysis';
COMMENT ON COLUMN game_location_history.game_id IS 'Reference to the game ID';
COMMENT ON COLUMN game_location_history.team_paths IS 'JSON object mapping team IDs to arrays of location history items {teamId: [{lat, lng, timestamp}, ...]}';
COMMENT ON COLUMN game_location_history.timestamp IS 'Unix timestamp of when this data was last updated';`
  }
];

type ViewMode = 'scripts' | 'diagnostics' | 'config';

const SupabaseScriptsModal: React.FC<SupabaseScriptsModalProps> = ({ onClose }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('diagnostics');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<SQLScript | null>(SQL_SCRIPTS[0]);
  const codeRef = React.useRef<HTMLElement>(null);

  // Track completed scripts and collapsed state
  const [completedScripts, setCompletedScripts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('completedSqlScripts');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [collapsedScripts, setCollapsedScripts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('collapsedSqlScripts');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Diagnostics state
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string; latency?: number } | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  useEffect(() => {
    const url = localStorage.getItem('SUPABASE_URL') ||
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://yktaxljydisfjyqhbnja.supabase.co';

    const key = localStorage.getItem('SUPABASE_ANON_KEY') ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdGF4bGp5ZGlzZmp5cWhibmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzQ2ODYsImV4cCI6MjA4MTcxMDY4Nn0.XeTW4vHGbEm6C7U94zMLsZiDB80cyvuqYbSRNX8oyQI';

    setSupabaseUrl(url);
    setSupabaseKey(key.substring(0, 20) + '...');

    runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleCopy = async (script: SQLScript) => {
    try {
      // Try modern Clipboard API first
      await navigator.clipboard.writeText(script.sql);
      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // Fallback for restricted contexts (iframes, etc.)
      try {
        const textarea = document.createElement('textarea');
        textarea.value = script.sql;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (successful) {
          setCopiedId(script.id);
          setTimeout(() => setCopiedId(null), 2000);
        } else {
          console.error('Fallback copy failed');
          alert('Copy failed. Please manually select and copy the SQL code.');
        }
      } catch (fallbackErr) {
        console.error('Both copy methods failed:', fallbackErr);
        alert('Copy failed. Please manually select and copy the SQL code.');
      }
    }
  };

  const handleSelectAll = () => {
    if (codeRef.current) {
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const toggleScriptCompletion = (scriptId: string) => {
    const newCompleted = new Set(completedScripts);
    if (newCompleted.has(scriptId)) {
      newCompleted.delete(scriptId);
      // Also uncollapse when unmarking as complete
      const newCollapsed = new Set(collapsedScripts);
      newCollapsed.delete(scriptId);
      setCollapsedScripts(newCollapsed);
      localStorage.setItem('collapsedSqlScripts', JSON.stringify([...newCollapsed]));
    } else {
      newCompleted.add(scriptId);
      // Auto-collapse when marking as complete
      const newCollapsed = new Set(collapsedScripts);
      newCollapsed.add(scriptId);
      setCollapsedScripts(newCollapsed);
      localStorage.setItem('collapsedSqlScripts', JSON.stringify([...newCollapsed]));
    }
    setCompletedScripts(newCompleted);
    localStorage.setItem('completedSqlScripts', JSON.stringify([...newCompleted]));
  };

  const toggleScriptCollapse = (scriptId: string) => {
    const newCollapsed = new Set(collapsedScripts);
    if (newCollapsed.has(scriptId)) {
      newCollapsed.delete(scriptId);
    } else {
      newCollapsed.add(scriptId);
    }
    setCollapsedScripts(newCollapsed);
    localStorage.setItem('collapsedSqlScripts', JSON.stringify([...newCollapsed]));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'setup':
        return 'bg-orange-900/30 text-orange-400 border-orange-700';
      case 'migrations':
        return 'bg-emerald-900/30 text-emerald-400 border-emerald-700';
      case 'utilities':
        return 'bg-purple-900/30 text-purple-400 border-purple-700';
      default:
        return 'bg-slate-900/30 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-green-600 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-b border-green-700 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-600/20 border border-green-500 flex items-center justify-center">
                <Database className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wider">SUPABASE</h2>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">
                  Database Management & Scripts
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('diagnostics')}
              className={`px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                viewMode === 'diagnostics'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              DIAGNOSTICS
            </button>
            <button
              onClick={() => setViewMode('scripts')}
              className={`px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                viewMode === 'scripts'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" />
              SQL SCRIPTS ({SQL_SCRIPTS.length})
            </button>
            <button
              onClick={() => setViewMode('config')}
              className={`px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                viewMode === 'config'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              CONFIGURATION
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* DIAGNOSTICS VIEW */}
          {viewMode === 'diagnostics' && (
            <div className="p-6 space-y-6 overflow-y-auto h-full">
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

              {/* Quick Actions */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-black text-slate-400 uppercase mb-3">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => window.open('https://supabase.com/dashboard/project/yktaxljydisfjyqhbnja', '_blank')}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open My Supabase Project
                  </button>

                  <button
                    onClick={() => window.open('https://supabase.com/dashboard/project/yktaxljydisfjyqhbnja/sql/5f49e3d9-339b-4fd1-ac3b-8f368f6d6eb9', '_blank')}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Terminal className="w-4 h-4" />
                    Open SQL Editor (Direct)
                  </button>

                  <button
                    onClick={() => setViewMode('scripts')}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
                  >
                    View SQL Scripts & Migrations
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('This will clear all local data and use demo mode. Continue?')) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-bold uppercase text-xs transition-colors"
                  >
                    Reset to Demo Mode
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SCRIPTS VIEW */}
          {viewMode === 'scripts' && (
            <div className="flex h-full">
              {/* Sidebar - Script List */}
              <div className="w-80 border-r border-slate-800 overflow-y-auto">
                <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Available Scripts ({SQL_SCRIPTS.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {SQL_SCRIPTS.map(script => {
                    const isCompleted = completedScripts.has(script.id);
                    return (
                      <button
                        key={script.id}
                        onClick={() => setSelectedScript(script)}
                        className={`w-full text-left p-4 transition-colors group hover:bg-slate-800/50 ${
                          selectedScript?.id === script.id
                            ? 'bg-green-900/20 border-l-4 border-green-500'
                            : isCompleted
                              ? 'bg-emerald-950/30 border-l-4 border-emerald-600'
                              : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isCompleted && (
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <h4 className={`text-sm font-black uppercase leading-tight ${
                              isCompleted ? 'text-emerald-300' : 'text-white'
                            }`}>
                              {script.title}
                            </h4>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-slate-600 group-hover:text-green-400 transition-colors shrink-0 ${
                            selectedScript?.id === script.id ? 'text-green-400' : ''
                          }`} />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                          {script.description}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${getCategoryColor(script.category)}`}>
                            {script.category}
                          </span>
                          <span className="text-[9px] text-slate-600 font-bold">
                            {script.createdDate}
                          </span>
                          {isCompleted && (
                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wide">
                              ✓ DONE
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Panel - Script Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {selectedScript ? (
                  <>
                    {/* Script Header */}
                    <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-black text-white uppercase tracking-wide">
                              {selectedScript.title}
                            </h3>
                            {completedScripts.has(selectedScript.id) && (
                              <span className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                COMPLETED
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            {selectedScript.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => toggleScriptCompletion(selectedScript.id)}
                            className={`px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                              completedScripts.has(selectedScript.id)
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
                            }`}
                            title={completedScripts.has(selectedScript.id) ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            {completedScripts.has(selectedScript.id) ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                DONE
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                MARK DONE
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => window.open('https://supabase.com/dashboard/project/yktaxljydisfjyqhbnja/sql/5f49e3d9-339b-4fd1-ac3b-8f368f6d6eb9', '_blank')}
                            className="px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest transition-all bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white flex items-center gap-2"
                            title="Open Supabase SQL Editor"
                          >
                            <ExternalLink className="w-4 h-4" />
                            SQL EDITOR
                          </button>
                          <button
                            onClick={() => handleCopy(selectedScript)}
                            className={`px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                              copiedId === selectedScript.id
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            {copiedId === selectedScript.id ? (
                              <>
                                <Check className="w-4 h-4" />
                                COPIED!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                COPY SQL
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleSelectAll}
                            className="px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-widest transition-all bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white"
                            title="Select all text for manual copy"
                          >
                            SELECT ALL
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className={`px-2 py-1 rounded border ${getCategoryColor(selectedScript.category)} font-bold uppercase tracking-wide`}>
                          {selectedScript.category}
                        </span>
                        <span className="text-slate-600 font-bold">
                          Created: {selectedScript.createdDate}
                        </span>
                      </div>
                    </div>

                    {/* SQL Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
                      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleScriptCollapse(selectedScript.id)}
                          className="w-full bg-slate-950/50 border-b border-slate-800 px-4 py-2 flex items-center justify-between hover:bg-slate-900/50 transition-colors"
                        >
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <ChevronDown className={`w-4 h-4 transition-transform ${
                              collapsedScripts.has(selectedScript.id) ? '-rotate-90' : ''
                            }`} />
                            SQL Script {collapsedScripts.has(selectedScript.id) ? '(Collapsed)' : ''}
                          </span>
                          <span className="text-[9px] text-slate-600 font-mono">
                            {selectedScript.sql.split('\n').length} lines
                          </span>
                        </button>
                        {!collapsedScripts.has(selectedScript.id) && (
                          <pre className="p-4 overflow-x-auto text-xs text-green-400 font-mono leading-relaxed">
                            <code ref={codeRef}>{selectedScript.sql}</code>
                          </pre>
                        )}
                        {collapsedScripts.has(selectedScript.id) && (
                          <div className="p-4 text-center">
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">
                              Script collapsed
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              Click the header above to expand
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Instructions */}
                      <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                        <h4 className="text-sm font-black text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          How to Run This Script
                        </h4>

                        {/* Quick Action Button */}
                        <button
                          onClick={() => {
                            handleCopy(selectedScript);
                            setTimeout(() => {
                              window.open('https://supabase.com/dashboard/project/yktaxljydisfjyqhbnja/sql/5f49e3d9-339b-4fd1-ac3b-8f368f6d6eb9', '_blank');
                            }, 100);
                          }}
                          className="w-full mb-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-black uppercase text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Copy & Open SQL Editor
                        </button>

                        <div className="border-t border-blue-700/30 pt-3">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3">Manual Steps:</p>
                          <ol className="text-xs text-slate-300 space-y-2 leading-relaxed">
                            <li className="flex gap-2">
                              <span className="font-black text-blue-400 shrink-0">1.</span>
                              <span>Open your <strong className="text-white">Supabase Dashboard</strong></span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-black text-blue-400 shrink-0">2.</span>
                              <span>Navigate to <strong className="text-white">SQL Editor</strong> (in the left sidebar)</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-black text-blue-400 shrink-0">3.</span>
                              <span>Click <strong className="text-white">"COPY SQL"</strong> button above</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-black text-blue-400 shrink-0">4.</span>
                              <span>Paste the SQL into the editor</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-black text-blue-400 shrink-0">5.</span>
                              <span>Click <strong className="text-white">"Run"</strong> to execute the script</span>
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <Database className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                      <h3 className="text-lg font-black text-slate-600 uppercase tracking-wider mb-2">
                        Select a Script
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Choose a script from the list on the left to view its SQL code and instructions.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONFIGURATION VIEW */}
          {viewMode === 'config' && (
            <div className="p-6 space-y-6 overflow-y-auto h-full">
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

              {/* Configuration Actions */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-black text-slate-400 uppercase mb-3">Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={updateSupabaseConfig}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
                  >
                    Update Supabase Credentials
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('This will clear all local settings. Continue?')) {
                        localStorage.removeItem('SUPABASE_URL');
                        localStorage.removeItem('SUPABASE_ANON_KEY');
                        alert('✅ Credentials cleared! Using defaults...');
                        window.location.reload();
                      }
                    }}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold uppercase text-xs transition-colors"
                  >
                    Clear Custom Credentials
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Supabase Database Management Tool
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-bold uppercase text-xs tracking-widest transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupabaseScriptsModal;

// Helper function to check if there's new Supabase setup code that hasn't been marked as done
export const hasNewSupabaseSetup = (): boolean => {
  // This is no longer needed as we now have a comprehensive UI
  // Keeping for backwards compatibility
  return false;
};
