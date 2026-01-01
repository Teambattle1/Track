import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, QrCode, Download, CheckSquare, Square, AlertTriangle, MapPin, Zap, Radio, Smartphone, CalendarDays, Clock3, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Game, GamePoint, PointActivationType } from '../types';

interface QRCodesToolProps {
  games: Game[];
  activeGameId: string | null;
  onSelectGame: (id: string) => void;
  onClose: () => void;
}

type ActivationBadge = {
  id: PointActivationType;
  label: string;
  icon: any;
  color: string;
};

const ACTIVATION_BADGES: ActivationBadge[] = [
  { id: 'qr', label: 'QR', icon: QrCode, color: 'bg-indigo-500' },
  { id: 'nfc', label: 'NFC', icon: Smartphone, color: 'bg-emerald-500' },
  { id: 'ibeacon', label: 'iBeacon', icon: Radio, color: 'bg-cyan-500' },
  { id: 'click', label: 'Tap', icon: Zap, color: 'bg-amber-500' },
  { id: 'radius', label: 'GPS', icon: MapPin, color: 'bg-slate-500' }
];

type GameStatusTab = 'TODAY' | 'PLANNED' | 'COMPLETED';

const safeFileName = (input: string) => input.replace(/[^a-z0-9\-_.]+/gi, '_').slice(0, 80);

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const parsePlayingDate = (value: string): Date | null => {
  const trimmed = value.trim();
  // Common UI date input stores YYYY-MM-DD (treat as local day, not UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getGameSessionDate = (game: Game) => {
  const maybe = game?.client?.playingDate ? parsePlayingDate(game.client.playingDate) : null;
  if (maybe) return maybe;
  return new Date(game.createdAt || Date.now());
};

const isGameCompleted = (game: Game) => {
  if (game.state === 'ended') return true;
  const points = game.points || [];
  const playable = points.filter(p => !p.isSectionHeader);
  if (playable.length === 0) return false;
  return playable.every(p => !!p.isCompleted);
};

const getGameStatusTab = (game: Game, now: Date): GameStatusTab => {
  if (isGameCompleted(game)) return 'COMPLETED';

  const date = getGameSessionDate(game);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (date.getTime() < startOfToday.getTime()) return 'COMPLETED';
  if (date.getTime() >= startOfTomorrow.getTime()) return 'PLANNED';
  return 'TODAY';
};

const getPointHasNonGpsActivation = (p: GamePoint) => (p.activationTypes || []).some(t => t !== 'radius');

const getPointQrValue = (p: GamePoint) => {
  // Primary: explicit QR string
  if (p.qrCodeString && p.qrCodeString.trim()) return p.qrCodeString.trim();
  // Secondary: manual unlock code (some teams use this as printed code)
  if (p.manualUnlockCode && p.manualUnlockCode.trim()) return p.manualUnlockCode.trim();
  // Fallback: point id (always unique, but less human friendly)
  return p.id;
};

const QRCodesTool: React.FC<QRCodesToolProps> = ({ games, activeGameId, onSelectGame, onClose }) => {
  const [search, setSearch] = useState('');
  const [gameTab, setGameTab] = useState<GameStatusTab>('TODAY');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(activeGameId);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const selectedGame = useMemo(
    () => (selectedGameId ? games.find(g => g.id === selectedGameId) || null : null),
    [games, selectedGameId]
  );

  useEffect(() => {
    setSelectedGameId(activeGameId);
    if (activeGameId) {
      const g = games.find(x => x.id === activeGameId);
      if (g) setGameTab(getGameStatusTab(g, new Date()));
    }
  }, [activeGameId, games]);

  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [selectedGameId]);

  const gamesBySearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return games;
    return games.filter(g => (g.title || g.name || '').toLowerCase().includes(q));
  }, [games, search]);

  const tabCounts = useMemo(() => {
    const now = new Date();
    return gamesBySearch.reduce(
      (acc, g) => {
        const tab = getGameStatusTab(g, now);
        acc[tab] += 1;
        return acc;
      },
      { TODAY: 0, PLANNED: 0, COMPLETED: 0 } as Record<GameStatusTab, number>
    );
  }, [gamesBySearch]);

  const filteredGames = useMemo(() => {
    const now = new Date();

    const inTab = gamesBySearch.filter(g => getGameStatusTab(g, now) === gameTab);

    const sorted = inTab
      .slice()
      .sort((a, b) => {
        const da = getGameSessionDate(a).getTime();
        const db = getGameSessionDate(b).getTime();

        if (gameTab === 'PLANNED') return da - db; // soonest first
        if (gameTab === 'COMPLETED') return db - da; // newest completed first

        // TODAY
        const nowTs = now.getTime();
        const aSame = isSameLocalDay(getGameSessionDate(a), now);
        const bSame = isSameLocalDay(getGameSessionDate(b), now);
        if (aSame !== bSame) return aSame ? -1 : 1;
        return Math.abs(da - nowTs) - Math.abs(db - nowTs);
      });

    return sorted;
  }, [gamesBySearch, gameTab]);

  const nonGpsTasks = useMemo(() => {
    if (!selectedGame) return [];
    return (selectedGame.points || [])
      .filter(p => !p.isSectionHeader)
      .filter(getPointHasNonGpsActivation)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [selectedGame]);

  const qrCapableTasks = useMemo(() => nonGpsTasks.filter(p => (p.activationTypes || []).includes('qr') || !!p.qrCodeString || !!p.manualUnlockCode), [nonGpsTasks]);

  const selectedQrTasks = useMemo(
    () => qrCapableTasks.filter(p => selectedTaskIds.has(p.id)),
    [qrCapableTasks, selectedTaskIds]
  );

  const toggleSelected = (pointId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(pointId)) next.delete(pointId);
      else next.add(pointId);
      return next;
    });
  };

  const setGame = (id: string) => {
    setSelectedGameId(id);
    const g = games.find(x => x.id === id);
    if (g) setGameTab(getGameStatusTab(g, new Date()));
    onSelectGame(id);
  };

  const downloadSingleQr = async (game: Game, point: GamePoint) => {
    try {
      setDownloading(true);
      const value = getPointQrValue(point);
      const dataUrl = await QRCode.toDataURL(value, {
        width: 600,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const fileName = safeFileName(`${game.title || game.name || 'game'}-${point.title}-QR.png`);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      link.click();
    } catch (e) {
      console.error('QR download failed', e);
      alert('Failed to download QR code');
    } finally {
      setDownloading(false);
    }
  };

  const downloadSelectedPdf = async () => {
    if (!selectedGame) return;

    try {
      setDownloading(true);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const marginTop = 46;
      const titleY = 36;
      const qrSize = Math.min(360, pageWidth - 120);
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 110;

      for (let i = 0; i < selectedQrTasks.length; i++) {
        const point = selectedQrTasks[i];
        const value = getPointQrValue(point);

        const dataUrl = await QRCode.toDataURL(value, {
          width: 800,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });

        if (i > 0) pdf.addPage();

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(String(selectedGame.title || selectedGame.name || 'Game'), 60, titleY);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.text(String(point.title || 'Task'), 60, titleY + 18);

        pdf.setFontSize(9);
        pdf.text(`QR: ${value}`, 60, titleY + 36);

        pdf.addImage(dataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        pdf.setDrawColor(40, 40, 40);
        pdf.setLineWidth(1);
        pdf.roundedRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12, 12);

        pdf.setFontSize(8);
        pdf.setTextColor(90, 90, 90);
        pdf.text('TEAMCHALLENGE • SYSTEM TOOLS • QR CODES', 60, pageHeight - marginTop);
        pdf.setTextColor(0, 0, 0);
      }

      const pdfName = safeFileName(`${selectedGame.title || selectedGame.name || 'game'}-QR-CODES.pdf`);
      pdf.save(pdfName);
    } catch (e) {
      console.error('Bulk QR PDF failed', e);
      alert('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const selectAllQr = () => {
    setSelectedTaskIds(new Set(qrCapableTasks.map(t => t.id)));
  };

  const clearSelection = () => setSelectedTaskIds(new Set());

  return (
    <div className="fixed inset-0 z-[6500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-indigo-900/20 to-slate-950 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <QrCode className="w-7 h-7 text-indigo-400" />
              QR CODES
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">
              Select a game • List tasks with QR / NFC / Tap / iBeacon • Download single or bulk QR
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: Game selector */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center">
                <Search className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white uppercase tracking-wider">Game Selector</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Choose a game to print</p>
              </div>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {/* Tabs */}
            <div className="mt-4 bg-slate-950 border border-slate-800 rounded-2xl p-1 flex gap-1">
              <button
                onClick={() => {
                  setGameTab('TODAY');
                  if (selectedGameId) {
                    const g = games.find(x => x.id === selectedGameId);
                    if (g && getGameStatusTab(g, new Date()) !== 'TODAY') setSelectedGameId(null);
                  }
                }}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  gameTab === 'TODAY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
                title="Games scheduled for today"
              >
                <Clock3 className="w-4 h-4" />
                Today
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gameTab === 'TODAY' ? 'bg-white/15' : 'bg-white/5 text-slate-400'}`}>{tabCounts.TODAY}</span>
              </button>
              <button
                onClick={() => {
                  setGameTab('PLANNED');
                  if (selectedGameId) {
                    const g = games.find(x => x.id === selectedGameId);
                    if (g && getGameStatusTab(g, new Date()) !== 'PLANNED') setSelectedGameId(null);
                  }
                }}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  gameTab === 'PLANNED' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
                title="Future planned games"
              >
                <CalendarDays className="w-4 h-4" />
                Planned
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gameTab === 'PLANNED' ? 'bg-white/15' : 'bg-white/5 text-slate-400'}`}>{tabCounts.PLANNED}</span>
              </button>
              <button
                onClick={() => {
                  setGameTab('COMPLETED');
                  if (selectedGameId) {
                    const g = games.find(x => x.id === selectedGameId);
                    if (g && getGameStatusTab(g, new Date()) !== 'COMPLETED') setSelectedGameId(null);
                  }
                }}
                className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  gameTab === 'COMPLETED' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
                title="Completed games"
              >
                <CheckCircle2 className="w-4 h-4" />
                Done
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gameTab === 'COMPLETED' ? 'bg-white/15' : 'bg-white/5 text-slate-400'}`}>{tabCounts.COMPLETED}</span>
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-[52vh] overflow-y-auto custom-scrollbar">
              {filteredGames.map((g) => {
                const isActive = selectedGameId === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGame(g.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-white/10 hover:bg-slate-900/60'
                    }`}
                  >
                    <p className="text-sm font-black text-white uppercase tracking-wider truncate">{g.title || g.name || 'UNTITLED GAME'}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      {(g.points || []).filter(p => !p.isSectionHeader).length} tasks
                    </p>
                  </button>
                );
              })}

              {filteredGames.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-8">No games found</div>
              )}
            </div>
          </div>

          {/* Right: Task list */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            {!selectedGame ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                Select a game to see tasks
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-widest">{selectedGame.title || selectedGame.name}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      Showing {nonGpsTasks.length} task(s) with non-GPS activation
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={selectAllQr}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 transition-colors flex items-center gap-2"
                      title="Select all QR-capable tasks"
                    >
                      <CheckSquare className="w-4 h-4 text-indigo-300" />
                      Select All QR
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-2"
                      title="Clear selection"
                    >
                      <Square className="w-4 h-4" />
                      Clear
                    </button>
                    <button
                      onClick={downloadSelectedPdf}
                      disabled={selectedQrTasks.length === 0 || downloading}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors flex items-center gap-2"
                      title="Download selected QR codes as a PDF"
                    >
                      {downloading ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          Creating PDF...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download Selected ({selectedQrTasks.length})
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {ACTIVATION_BADGES.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 px-2 py-1 bg-slate-950/70 border border-slate-800 rounded-lg"
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${b.color} bg-opacity-20 border border-white/10`}>
                        <b.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{b.label}</span>
                    </div>
                  ))}
                </div>

                {nonGpsTasks.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-10">
                    No tasks with QR / NFC / Tap / iBeacon found in this game
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                      <thead>
                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <th className="py-2 pr-3">Select</th>
                          <th className="py-2 pr-3">Task</th>
                          <th className="py-2 pr-3">Activation</th>
                          <th className="py-2 pr-3">QR Value</th>
                          <th className="py-2 text-right">Download</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nonGpsTasks.map((p) => {
                          const isQr = (p.activationTypes || []).includes('qr') || !!p.qrCodeString || !!p.manualUnlockCode;
                          const qrValue = isQr ? getPointQrValue(p) : '';
                          const checked = selectedTaskIds.has(p.id);

                          return (
                            <tr key={p.id} className="border-t border-slate-800">
                              <td className="py-3 pr-3 align-top">
                                <button
                                  onClick={() => isQr && toggleSelected(p.id)}
                                  className={`p-2 rounded-lg border transition-colors ${
                                    isQr
                                      ? 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                                      : 'bg-slate-950/40 border-slate-900 cursor-not-allowed opacity-50'
                                  }`}
                                  title={isQr ? 'Select for bulk download' : 'No QR configured for this task'}
                                >
                                  {checked ? (
                                    <CheckSquare className="w-4 h-4 text-indigo-300" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-500" />
                                  )}
                                </button>
                              </td>

                              <td className="py-3 pr-3 align-top">
                                <p className="text-sm font-black text-white uppercase tracking-wider">{p.title}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">#{p.order ?? 0}</p>
                              </td>

                              <td className="py-3 pr-3 align-top">
                                <div className="flex flex-wrap gap-1.5">
                                  {(p.activationTypes || []).map((t) => {
                                    const b = ACTIVATION_BADGES.find(x => x.id === t);
                                    if (!b) return null;
                                    const BadgeIcon = b.icon;
                                    return (
                                      <span
                                        key={`${p.id}-${t}`}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg"
                                        title={b.label}
                                      >
                                        <BadgeIcon className="w-3.5 h-3.5 text-white/80" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{b.label}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>

                              <td className="py-3 pr-3 align-top">
                                {isQr ? (
                                  <p className="text-xs font-mono text-slate-200 break-all">{qrValue}</p>
                                ) : (
                                  <div className="flex items-center gap-2 text-slate-500">
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-bold uppercase tracking-widest">No QR</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-3 text-right align-top">
                                <button
                                  onClick={() => selectedGame && downloadSingleQr(selectedGame, p)}
                                  disabled={!isQr || downloading}
                                  className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-950 hover:bg-slate-900 disabled:bg-slate-900/40 disabled:text-slate-600 disabled:cursor-not-allowed border border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors"
                                  title="Download QR as PNG"
                                >
                                  <Download className="w-4 h-4" />
                                  PNG
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodesTool;
