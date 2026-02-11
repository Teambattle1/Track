-- TeamTrack Database Schema
-- Run this in Supabase SQL Editor to create all required tables
-- Last updated: 2026-01-18

-- ============================================
-- CORE TABLES
-- ============================================

-- Games table - stores game configurations
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at DESC);

-- Teams table - stores team registrations and progress
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    join_code TEXT,
    photo_url TEXT,
    members JSONB DEFAULT '[]',
    score INTEGER DEFAULT 0,
    captain_device_id TEXT,
    is_started BOOLEAN DEFAULT FALSE,
    completed_point_ids JSONB DEFAULT '[]',
    color TEXT,
    short_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_game_id ON teams(game_id);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);
CREATE INDEX IF NOT EXISTS idx_teams_short_code ON teams(game_id, short_code);

-- Library table - stores task templates
CREATE TABLE IF NOT EXISTS library (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_updated_at ON library(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_created_at ON library(created_at DESC);

-- Task Lists table - stores collections of tasks
CREATE TABLE IF NOT EXISTS task_lists (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_lists_updated_at ON task_lists(updated_at DESC);

-- User Settings table - stores per-user and system-wide settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playground Library table - stores playground templates
CREATE TABLE IF NOT EXISTS playground_library (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    is_global BOOLEAN DEFAULT FALSE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playground_library_is_global ON playground_library(is_global);
CREATE INDEX IF NOT EXISTS idx_playground_library_updated_at ON playground_library(updated_at DESC);

-- Account Users table - stores user account data
CREATE TABLE IF NOT EXISTS account_users (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GAME ACTIVITY TABLES
-- ============================================

-- Game Location History table - stores team paths for replay
CREATE TABLE IF NOT EXISTS game_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL UNIQUE,
    team_paths JSONB NOT NULL DEFAULT '{}',
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_location_history_game_id ON game_location_history(game_id);
CREATE INDEX IF NOT EXISTS idx_game_location_history_updated_at ON game_location_history(updated_at);

-- Game Statistics table - stores game completion stats
CREATE TABLE IF NOT EXISTS game_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    game_name TEXT,
    timestamp BIGINT NOT NULL,
    teams_data JSONB,
    total_stats JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_statistics_game_id ON game_statistics(game_id);
CREATE INDEX IF NOT EXISTS idx_game_statistics_timestamp ON game_statistics(timestamp DESC);

-- Media Submissions table - stores photos/videos for live approval
CREATE TABLE IF NOT EXISTS media_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    team_name TEXT,
    point_id TEXT NOT NULL,
    point_title TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image',
    status TEXT DEFAULT 'pending',
    submitted_at BIGINT NOT NULL,
    reviewed_by TEXT,
    reviewed_at BIGINT,
    review_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_submissions_game_id ON media_submissions(game_id);
CREATE INDEX IF NOT EXISTS idx_media_submissions_status ON media_submissions(status);
CREATE INDEX IF NOT EXISTS idx_media_submissions_submitted_at ON media_submissions(submitted_at DESC);

-- Player Recovery Codes table - allows device recovery
CREATE TABLE IF NOT EXISTS player_recovery_codes (
    code TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_recovery_codes_device_id ON player_recovery_codes(device_id);
CREATE INDEX IF NOT EXISTS idx_player_recovery_codes_expires_at ON player_recovery_codes(expires_at);

-- Saved Locations table - stores favorite/saved map locations
CREATE TABLE IF NOT EXISTS saved_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_name ON saved_locations(name);
CREATE INDEX IF NOT EXISTS idx_saved_locations_created_at ON saved_locations(created_at DESC);

-- ============================================
-- MAP & STYLING TABLES
-- ============================================

-- Map Styles table - stores custom map styles
CREATE TABLE IF NOT EXISTS map_styles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    json TEXT NOT NULL,
    preview_url TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Translation Validation Results table
CREATE TABLE IF NOT EXISTS translation_validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id TEXT NOT NULL,
    game_name TEXT NOT NULL,
    point_id TEXT NOT NULL,
    point_title TEXT NOT NULL,
    language TEXT NOT NULL,
    missing_fields JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_translation_issue UNIQUE (game_id, point_id, language)
);

CREATE INDEX IF NOT EXISTS idx_translation_validation_game_id ON translation_validation_results(game_id);
CREATE INDEX IF NOT EXISTS idx_translation_validation_language ON translation_validation_results(language);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to atomically increment team score
CREATE OR REPLACE FUNCTION increment_score(team_id TEXT, amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE teams
    SET score = score + amount,
        updated_at = NOW()
    WHERE id = team_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Note: For development/demo, we disable RLS to allow anonymous access.
-- For production, enable RLS and create appropriate policies.

-- Disable RLS on all tables for anonymous access
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE library DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE playground_library DISABLE ROW LEVEL SECURITY;
ALTER TABLE account_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_location_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_statistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE media_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_recovery_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE map_styles DISABLE ROW LEVEL SECURITY;
ALTER TABLE translation_validation_results DISABLE ROW LEVEL SECURITY;

-- ============================================
-- GRANTS
-- ============================================
-- Grant full access to anon role (required for Supabase client without auth)

GRANT ALL ON games TO anon;
GRANT ALL ON teams TO anon;
GRANT ALL ON library TO anon;
GRANT ALL ON task_lists TO anon;
GRANT ALL ON user_settings TO anon;
GRANT ALL ON playground_library TO anon;
GRANT ALL ON account_users TO anon;
GRANT ALL ON game_location_history TO anon;
GRANT ALL ON game_statistics TO anon;
GRANT ALL ON media_submissions TO anon;
GRANT ALL ON player_recovery_codes TO anon;
GRANT ALL ON map_styles TO anon;
GRANT ALL ON translation_validation_results TO anon;

-- Grant function execution
GRANT EXECUTE ON FUNCTION increment_score TO anon;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE games IS 'Game configurations with full JSON data';
COMMENT ON TABLE teams IS 'Team registrations and progress tracking';
COMMENT ON TABLE library IS 'Task template library';
COMMENT ON TABLE task_lists IS 'Collections of tasks (lists)';
COMMENT ON TABLE user_settings IS 'Per-user and system-wide settings (tag colors, preferences)';
COMMENT ON TABLE playground_library IS 'Playground/arena templates';
COMMENT ON TABLE account_users IS 'User accounts and profiles';
COMMENT ON TABLE game_location_history IS 'Team location paths for replay';
COMMENT ON TABLE game_statistics IS 'Game completion statistics';
COMMENT ON TABLE media_submissions IS 'Photo/video submissions for live approval';
COMMENT ON TABLE player_recovery_codes IS 'Device recovery codes for players';
COMMENT ON TABLE map_styles IS 'Custom map styles (Google Maps JSON)';
