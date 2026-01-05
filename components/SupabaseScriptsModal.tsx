import React, { useState } from 'react';
import { X, Copy, Check, Database, ChevronRight } from 'lucide-react';

interface SupabaseScriptsModalProps {
  onClose: () => void;
}

interface SQLScript {
  id: string;
  title: string;
  description: string;
  category: 'migrations' | 'setup' | 'utilities';
  sql: string;
  createdDate: string;
}

const SQL_SCRIPTS: SQLScript[] = [
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

const SupabaseScriptsModal: React.FC<SupabaseScriptsModalProps> = ({ onClose }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<SQLScript | null>(null);

  const handleCopy = async (script: SQLScript) => {
    try {
      await navigator.clipboard.writeText(script.sql);
      setCopiedId(script.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'migrations':
        return 'bg-emerald-900/30 text-emerald-400 border-emerald-700';
      case 'setup':
        return 'bg-blue-900/30 text-blue-400 border-blue-700';
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-600/20 border border-green-500 flex items-center justify-center">
                <Database className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wider">SUPABASE</h2>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">
                  Database Migrations & Scripts
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar - Script List */}
          <div className="w-80 border-r border-slate-800 overflow-y-auto">
            <div className="p-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Available Scripts ({SQL_SCRIPTS.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-800">
              {SQL_SCRIPTS.map(script => (
                <button
                  key={script.id}
                  onClick={() => setSelectedScript(script)}
                  className={`w-full text-left p-4 transition-colors group hover:bg-slate-800/50 ${
                    selectedScript?.id === script.id ? 'bg-green-900/20 border-l-4 border-green-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-black text-white uppercase leading-tight">
                      {script.title}
                    </h4>
                    <ChevronRight className={`w-4 h-4 text-slate-600 group-hover:text-green-400 transition-colors shrink-0 ${
                      selectedScript?.id === script.id ? 'text-green-400' : ''
                    }`} />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                    {script.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${getCategoryColor(script.category)}`}>
                      {script.category}
                    </span>
                    <span className="text-[9px] text-slate-600 font-bold">
                      {script.createdDate}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Panel - Script Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedScript ? (
              <>
                {/* Script Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-wide mb-1">
                        {selectedScript.title}
                      </h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        {selectedScript.description}
                      </p>
                    </div>
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
                    <div className="bg-slate-950/50 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        SQL Script
                      </span>
                      <span className="text-[9px] text-slate-600 font-mono">
                        {selectedScript.sql.split('\n').length} lines
                      </span>
                    </div>
                    <pre className="p-4 overflow-x-auto text-xs text-green-400 font-mono leading-relaxed">
                      <code>{selectedScript.sql}</code>
                    </pre>
                  </div>

                  {/* Instructions */}
                  <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                    <h4 className="text-sm font-black text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      How to Run This Script
                    </h4>
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

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              Run these scripts in your Supabase SQL Editor
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
