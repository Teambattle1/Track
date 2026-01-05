-- Migration: Game Location History Table
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
-- (Adjust based on your security requirements)
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
COMMENT ON COLUMN game_location_history.timestamp IS 'Unix timestamp of when this data was last updated';
