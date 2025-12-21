
import React, { useState } from 'react';
import { Game } from '../types';
import { X, Trash2, Calendar, MapPin, Database, AlertTriangle, Terminal, Copy } from 'lucide-react';

interface AdminModalProps {
  games: Game[];
  onClose: () => void;
  onDeleteGame: (id: string) => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ games, onClose, onDeleteGame }) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmId === id) {
      onDeleteGame(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000); // Reset confirm after 3s
    }
  };

  const sqlCode = `-- COPY THIS INTO THE SUPABASE SQL EDITOR

-- 1. Create GAMES table
CREATE TABLE IF NOT EXISTS public.games (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public games access" ON public.games FOR ALL USING (true) WITH CHECK (true);

-- 2. Create TEAMS table
-- Note: 'members' uses JSONB to store [{name, photo, deviceId}]
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
CREATE POLICY "Public teams access" ON public.teams FOR ALL USING (true) WITH CHECK (true);

-- !!! CRITICAL FIX FOR DISAPPEARING MEMBERS !!!
-- Run this line if your members column was previously TEXT[]
-- ALTER TABLE public.teams DROP COLUMN members;
-- ALTER TABLE public.teams ADD COLUMN members JSONB DEFAULT '[]'::jsonb;

-- 3. Create LIBRARY table
CREATE TABLE IF NOT EXISTS public.library (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public library access" ON public.library FOR ALL USING (true) WITH CHECK (true);

-- 4. Create TASK_LISTS table
CREATE TABLE IF NOT EXISTS public.task_lists (
    id TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public task_lists access" ON public.task_lists FOR ALL USING (true) WITH CHECK (true);

-- 5. Create PLAYGROUND_LIBRARY table
CREATE TABLE IF NOT EXISTS public.playground_library (
    id TEXT PRIMARY KEY,
    title TEXT,
    is_global BOOLEAN DEFAULT false,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.playground_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public playground library access" ON public.playground_library FOR ALL USING (true) WITH CHECK (true);

-- 6. Enable Realtime for TEAMS
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;`;

  const copyToClipboard = () => {
      navigator.clipboard.writeText(sqlCode);
      alert("SQL copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Database className="w-5 h-5 text-red-500"/> ADMIN
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">MANAGE GAMES</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
          
          <button 
            onClick={() => setShowSql(!showSql)}
            className="w-full p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex items-center justify-between text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition-all mb-4"
          >
              <span className="text-xs font-bold uppercase flex items-center gap-2"><Terminal className="w-4 h-4" /> Setup Database Tables</span>
              <span className="text-[10px] bg-indigo-500/20 px-2 py-1 rounded">CLICK TO VIEW SQL</span>
          </button>

          {showSql && (
              <div className="bg-black rounded-xl p-4 border border-slate-700 mb-4 relative">
                  <pre className="text-[10px] text-green-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                      {sqlCode}
                  </pre>
                  <button 
                    onClick={copyToClipboard}
                    className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    title="Copy SQL"
                  >
                      <Copy className="w-4 h-4" />
                  </button>
                  <p className="text-[10px] text-slate-500 mt-2 italic">
                      Paste this into the Supabase SQL Editor to initialize your database.
                  </p>
              </div>
          )}

          {games.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-bold uppercase tracking-wide text-sm">NO GAMES FOUND</p>
            </div>
          )}

          {games.map(game => (
            <div key={game.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center justify-between group hover:border-slate-600 transition-colors">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="font-bold text-white truncate text-base mb-1 uppercase">{game.name}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium uppercase">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(game.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {game.points.length} TASKS</span>
                </div>
              </div>
              
              <button 
                onClick={() => handleDeleteClick(game.id)}
                className={`p-3 rounded-xl transition-all flex items-center gap-2 font-bold uppercase text-xs tracking-wider ${deleteConfirmId === game.id ? 'bg-red-600 text-white w-24 justify-center' : 'bg-slate-700 text-slate-400 hover:bg-red-900/30 hover:text-red-400'}`}
              >
                {deleteConfirmId === game.id ? (
                  "CONFIRM"
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <AlertTriangle className="w-3 h-3" /> WARNING: DELETING A GAME CANNOT BE UNDONE
            </p>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
