import React, { useState, useMemo } from 'react';
import { X, Gamepad2, Search, ChevronRight, Calendar, ChevronDown } from 'lucide-react';
import { Game } from '../types';

interface GameChooserViewProps {
  games: Game[];
  title: string;
  subtitle: string;
  accentColor: string; // e.g. 'orange' or 'purple'
  onSelectGame: (gameId: string) => void;
  onClose: () => void;
}

type Tab = 'TODAY' | 'PLANNED' | 'COMPLETED';

const getPlayingDate = (game: Game): string | null => {
  return game.client?.playingDate || null;
};

const isToday = (dateStr: string): boolean => {
  const today = new Date();
  const date = new Date(dateStr);
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
};

const isFuture = (dateStr: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return date > today;
};

const isPast = (dateStr: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return date < today;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
};

const GameChooserView: React.FC<GameChooserViewProps> = ({ games, title, subtitle, accentColor, onSelectGame, onClose }) => {
  const [tab, setTab] = useState<Tab>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [completedLimit, setCompletedLimit] = useState(10);

  const playableGames = games.filter(g => !g.isGameTemplate);

  const categorized = useMemo(() => {
    const today: Game[] = [];
    const planned: Game[] = [];
    const completed: Game[] = [];
    const noDate: Game[] = [];

    for (const g of playableGames) {
      const pd = getPlayingDate(g);
      if (!pd) {
        // Games without a playing date always show under TODAY
        today.push(g);
      } else if (isToday(pd)) {
        today.push(g);
      } else if (isFuture(pd)) {
        planned.push(g);
      } else if (isPast(pd)) {
        completed.push(g);
      }
    }

    // Sort planned by date ascending
    planned.sort((a, b) => {
      const da = getPlayingDate(a) || '';
      const db = getPlayingDate(b) || '';
      return da.localeCompare(db);
    });

    // Sort completed by date descending (most recent first)
    completed.sort((a, b) => {
      const da = getPlayingDate(a) || String(a.createdAt);
      const db = getPlayingDate(b) || String(b.createdAt);
      return db.localeCompare(da);
    });

    return { today, planned, completed };
  }, [playableGames]);

  const currentGames = tab === 'TODAY' ? categorized.today
    : tab === 'PLANNED' ? categorized.planned
    : categorized.completed;

  const displayGames = useMemo(() => {
    let filtered = currentGames.filter(g =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (tab === 'COMPLETED') {
      filtered = filtered.slice(0, completedLimit);
    }
    return filtered;
  }, [currentGames, searchQuery, completedLimit, tab]);

  const hasMoreCompleted = tab === 'COMPLETED' && currentGames.length > completedLimit;

  const accentBorder = accentColor === 'purple' ? 'border-purple-500/50' : 'border-orange-500/50';
  const accentBg = accentColor === 'purple' ? 'bg-purple-600/10' : 'bg-orange-600/10';
  const accentBorderLight = accentColor === 'purple' ? 'border-purple-500/20' : 'border-orange-500/20';
  const accentText = accentColor === 'purple' ? 'text-purple-500' : 'text-orange-500';
  const accentHover = accentColor === 'purple' ? 'hover:border-purple-500/40' : 'hover:border-orange-500/40';
  const accentFocus = accentColor === 'purple' ? 'focus:border-purple-500/50' : 'focus:border-orange-500/50';

  const tabCounts = {
    TODAY: categorized.today.length,
    PLANNED: categorized.planned.length,
    COMPLETED: categorized.completed.length,
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-lg max-h-[80vh] rounded-[2rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,1)] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d]/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${accentBg} rounded-2xl flex items-center justify-center border ${accentBorderLight}`}>
              <Gamepad2 className={`w-6 h-6 ${accentText}`} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">{title}</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 shrink-0">
          {(['TODAY', 'PLANNED', 'COMPLETED'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-center transition-all border-b-2 ${
                tab === t
                  ? `${accentText} border-current font-black`
                  : 'text-slate-600 border-transparent hover:text-slate-400'
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest">{t}</span>
              <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                tab === t ? 'bg-white/10' : 'bg-slate-800'
              }`}>
                {tabCounts[t]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-5 pt-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search games..."
              className={`w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 rounded-xl border-2 border-slate-300 ${accentFocus} focus:outline-none text-sm font-medium shadow-sm`}
            />
          </div>
        </div>

        {/* Game list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {displayGames.length === 0 ? (
            <div className="text-center py-16">
              <Gamepad2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600 uppercase">
                {searchQuery ? 'No matches' : tab === 'TODAY' ? 'No games today' : tab === 'PLANNED' ? 'No planned games' : 'No completed games'}
              </p>
            </div>
          ) : (
            displayGames.map(g => {
              const pd = getPlayingDate(g);
              return (
                <button
                  key={g.id}
                  onClick={() => onSelectGame(g.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800 ${accentHover} hover:bg-slate-800/60 transition-all text-left group`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                    <Gamepad2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">{g.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {pd && (
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          <Calendar className="w-3 h-3" />
                          {isToday(pd) ? 'I dag' : formatDate(pd)}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                        {g.points?.length || 0} tasks
                      </span>
                      {g.gameMode && g.gameMode !== 'standard' && (
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                          {g.gameMode}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              );
            })
          )}

          {/* Load more for completed */}
          {hasMoreCompleted && (
            <button
              onClick={() => setCompletedLimit(prev => prev + 10)}
              className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Load {Math.min(10, currentGames.length - completedLimit)} more
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameChooserView;
