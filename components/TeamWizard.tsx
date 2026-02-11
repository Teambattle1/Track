import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Wand2, Printer, Check, RefreshCw, QrCode, Plus, Minus, Hash, Palette } from 'lucide-react';
import { Team, Game } from '../types';
import * as db from '../services/db';
import { generateTeamShortCode } from '../utils/teamUtils';
import QRCode from 'qrcode';
import GameChooserView from './GameChooserView';

interface TeamWizardProps {
  gameId: string | null;
  games: Game[];
  onClose: () => void;
  onTeamsCreated?: () => void;
}

const TEAM_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
  '#f43f5e', '#a855f7', '#0ea5e9', '#84cc16', '#d946ef',
  '#fb923c', '#4ade80', '#38bdf8', '#c084fc', '#fbbf24',
];

interface CreatedTeam {
  team: Team;
  qrDataUrl: string;
}

const TeamWizard: React.FC<TeamWizardProps> = ({ gameId: initialGameId, games, onClose, onTeamsCreated }) => {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(initialGameId);
  const [teamCount, setTeamCount] = useState(10);
  const [namePrefix, setNamePrefix] = useState('Team');
  const [startNumber, setStartNumber] = useState(1);
  const [assignColors, setAssignColors] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdTeams, setCreatedTeams] = useState<CreatedTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const game = games.find(g => g.id === selectedGameId);

  const handleCreate = async () => {
    if (!selectedGameId || !game) return;
    setCreating(true);
    setError(null);

    try {
      const existingTeams = await db.fetchTeams(selectedGameId);
      const existingCodes = existingTeams.map(t => t.shortCode).filter(Boolean) as string[];
      const existingNames = new Set(existingTeams.map(t => t.name.toLowerCase()));
      const accessCode = game.accessCode || '';

      const created: CreatedTeam[] = [];

      for (let i = 0; i < teamCount; i++) {
        const num = startNumber + i;
        let teamName = `${namePrefix} ${num}`;

        // Skip if name already taken
        if (existingNames.has(teamName.toLowerCase())) {
          // Try appending letter
          for (const suffix of ['B', 'C', 'D', 'E']) {
            const alt = `${teamName}${suffix}`;
            if (!existingNames.has(alt.toLowerCase())) {
              teamName = alt;
              break;
            }
          }
        }
        existingNames.add(teamName.toLowerCase());

        const shortCode = generateTeamShortCode(existingCodes);
        existingCodes.push(shortCode);

        const teamId = `wizard-team-${Date.now()}-${i}`;
        const color = assignColors ? TEAM_COLORS[i % TEAM_COLORS.length] : undefined;

        const team: Team = {
          id: teamId,
          gameId: selectedGameId,
          name: teamName,
          joinCode: String(100000 + Math.floor(Math.random() * 900000)),
          members: [],
          score: 0,
          updatedAt: new Date().toISOString(),
          captainDeviceId: undefined,
          isStarted: false,
          completedPointIds: [],
          shortCode,
          color,
        };

        await db.registerTeam(team);

        // Generate QR code
        const url = `${window.location.origin}?teamCode=${shortCode}&gameCode=${accessCode}`;
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });

        created.push({ team, qrDataUrl });
      }

      setCreatedTeams(created);
      onTeamsCreated?.();
    } catch (err: any) {
      console.error('[TeamWizard] Error creating teams:', err);
      setError(err.message || 'Failed to create teams');
    } finally {
      setCreating(false);
    }
  };

  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => window.print(), 300);
  };

  // Game chooser
  if (!selectedGameId) {
    return (
      <GameChooserView
        games={games}
        title="TEAM WIZARD"
        subtitle="Select a game to create teams for"
        accentColor="orange"
        onSelectGame={(id) => setSelectedGameId(id)}
        onClose={onClose}
      />
    );
  }

  // Print view — fullscreen printable QR cards
  if (showPrintView && createdTeams.length > 0) {
    return (
      <div className="fixed inset-0 z-[6000] bg-white overflow-auto">
        {/* Screen-only header */}
        <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider">PRINT PREVIEW — {createdTeams.length} TEAMS</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-wider text-sm transition-colors"
            >
              <Printer className="w-5 h-5" /> PRINT
            </button>
            <button
              onClick={() => setShowPrintView(false)}
              className="p-3 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Printable cards grid */}
        <div ref={printRef} className="p-4">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              .print-area, .print-area * { visibility: visible !important; }
              .print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
              @page { margin: 10mm; size: A4; }
            }
          `}</style>
          <div className="print-area grid grid-cols-2 md:grid-cols-3 gap-4 max-w-[900px] mx-auto">
            {createdTeams.map(({ team, qrDataUrl }) => (
              <div
                key={team.id}
                className="border-2 border-gray-300 rounded-2xl p-5 flex flex-col items-center text-center break-inside-avoid"
                style={{ pageBreakInside: 'avoid' }}
              >
                {/* Team color stripe */}
                {team.color && (
                  <div className="w-full h-2 rounded-full mb-3" style={{ backgroundColor: team.color }} />
                )}

                {/* Team name */}
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-1">
                  {team.name}
                </h3>

                {/* Game name */}
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  {game?.name}
                </p>

                {/* QR Code */}
                <img src={qrDataUrl} alt={`QR for ${team.name}`} className="w-40 h-40 mb-3" />

                {/* Short code */}
                <div className="bg-gray-100 rounded-xl px-5 py-2 mb-2">
                  <p className="text-2xl font-black text-gray-900 tracking-[0.3em] font-mono">
                    {team.shortCode}
                  </p>
                </div>

                {/* Instructions */}
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  SCAN QR OR ENTER CODE TO JOIN
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-lg max-h-[90vh] rounded-[2rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,1)] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0f1d]/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
              <Wand2 className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">TEAM WIZARD</h2>
              <p className="text-sm text-slate-300 font-black uppercase tracking-wider mt-0.5">
                <span className="text-slate-500">GAME: </span>
                <button onClick={() => setSelectedGameId(null)} className="text-orange-400 hover:text-orange-300 transition-colors">
                  {game?.name || 'Unknown'}
                </button>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {createdTeams.length === 0 ? (
            /* ========== SETUP FORM ========== */
            <div className="space-y-6">
              {/* Team count */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">
                  NUMBER OF TEAMS
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setTeamCount(Math.max(1, teamCount - 1))}
                    className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={teamCount}
                    onChange={(e) => setTeamCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-3xl font-black text-white outline-none focus:border-orange-500 transition-colors"
                  />
                  <button
                    onClick={() => setTeamCount(Math.min(50, teamCount + 1))}
                    className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  {[5, 10, 15, 20, 30].map(n => (
                    <button
                      key={n}
                      onClick={() => setTeamCount(n)}
                      className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                        teamCount === n
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name prefix */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                  TEAM NAME PREFIX
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={namePrefix}
                    onChange={(e) => setNamePrefix(e.target.value)}
                    placeholder="Team"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 pl-12 py-3 text-white font-bold outline-none text-sm uppercase tracking-wide focus:border-orange-500 transition-colors placeholder-slate-600"
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-wider">
                  PREVIEW: {namePrefix} {startNumber}, {namePrefix} {startNumber + 1}, ... {namePrefix} {startNumber + teamCount - 1}
                </p>
              </div>

              {/* Start number */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                  START NUMBER
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold outline-none text-sm tracking-wide focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Assign colors toggle */}
              <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-wider">ASSIGN COLORS</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">EACH TEAM GETS A UNIQUE COLOR</p>
                  </div>
                </div>
                <button
                  onClick={() => setAssignColors(!assignColors)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    assignColors ? 'bg-orange-600' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${
                    assignColors ? 'left-6' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Color preview */}
              {assignColors && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(teamCount, 20) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-lg border border-white/20"
                      style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }}
                      title={`${namePrefix} ${startNumber + i}`}
                    />
                  ))}
                  {teamCount > 20 && (
                    <span className="text-xs text-slate-500 font-bold self-center ml-1">+{teamCount - 20} MORE</span>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-xs font-bold">
                  {error}
                </div>
              )}

              {/* Create button */}
              <button
                onClick={handleCreate}
                disabled={creating || !namePrefix.trim()}
                className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-3"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    CREATING {teamCount} TEAMS...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    CREATE {teamCount} TEAMS
                  </>
                )}
              </button>
            </div>
          ) : (
            /* ========== RESULTS VIEW ========== */
            <div className="space-y-4">
              {/* Success banner */}
              <div className="bg-emerald-900/30 border-2 border-emerald-500/40 rounded-2xl p-5 text-center">
                <Check className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-lg font-black text-white uppercase tracking-wider">
                  {createdTeams.length} TEAMS CREATED
                </p>
                <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider mt-1">
                  PLAYERS CAN NOW SCAN QR CODES TO JOIN
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> PRINT QR CARDS
                </button>
                <button
                  onClick={() => { setCreatedTeams([]); setError(null); }}
                  className="py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Plus className="w-5 h-5" /> MORE
                </button>
              </div>

              {/* Team cards preview */}
              <div className="grid grid-cols-2 gap-3">
                {createdTeams.map(({ team, qrDataUrl }) => (
                  <div
                    key={team.id}
                    className="bg-black/30 border border-slate-700 rounded-xl p-3 flex flex-col items-center text-center"
                  >
                    {team.color && (
                      <div className="w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: team.color }} />
                    )}
                    <p className="text-xs font-black text-white uppercase tracking-wider mb-1">{team.name}</p>
                    <img src={qrDataUrl} alt="" className="w-20 h-20 rounded-lg mb-1" />
                    <p className="text-sm font-black text-orange-400 tracking-[0.2em] font-mono">{team.shortCode}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamWizard;
