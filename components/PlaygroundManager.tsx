import React, { useState, useEffect } from 'react';
import { PlaygroundTemplate, Game } from '../types';
import * as db from '../services/db';
import { X, Plus, Globe, Trash2, Edit2, LayoutGrid, Image as ImageIcon, Loader2, PlayCircle, Copy, AlertTriangle, Check, CheckCircle } from 'lucide-react';
import { createTaskIdMap, remapTaskLogicTargets, validateTaskReferences } from '../utils/taskIdRemapping';

interface PlaygroundManagerProps {
  onClose: () => void;
  onEdit: (template: PlaygroundTemplate) => void;
  onCreate: () => void;
  onUseInGame?: (template: PlaygroundTemplate) => void; // New prop for using template
  onGameUpdated?: (game: Game) => void; // Callback when a game is updated with new playzone
}

const PlaygroundManager: React.FC<PlaygroundManagerProps> = ({ onClose, onEdit, onCreate, onUseInGame, onGameUpdated }) => {
  const [templates, setTemplates] = useState<PlaygroundTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteWarningTemplate, setDeleteWarningTemplate] = useState<PlaygroundTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [selectedTemplateForGame, setSelectedTemplateForGame] = useState<PlaygroundTemplate | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'TODAY' | 'PLANNED' | 'COMPLETED'>('TODAY');
  const [successMessage, setSuccessMessage] = useState<{ template: string; game: string; taskCount: number } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await db.fetchPlaygroundLibrary();

      console.log('[PlaygroundManager] Loaded templates:', {
          count: data.length,
          templates: data.map(t => ({
              id: t.id,
              title: t.title,
              taskCount: t.tasks?.length || 0,
              hasPlaygroundData: !!t.playgroundData,
              hasTasks: !!t.tasks
          }))
      });

      // Validate templates - ensure all have tasks
      const validTemplates = data.filter(t => t.tasks && t.tasks.length > 0);
      const invalidCount = data.length - validTemplates.length;

      if (invalidCount > 0) {
          console.warn(`[PlaygroundManager] Found ${invalidCount} templates without tasks. These should be deleted.`);
      }

      setTemplates(data);
    } catch (error) {
      console.error('[PlaygroundManager] Error loading templates:', error);
      alert('Failed to load templates. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (template: PlaygroundTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setDeleteWarningTemplate(template);
  };

  const confirmDelete = async () => {
      if (!deleteWarningTemplate) return;

      try {
          await db.deletePlaygroundTemplate(deleteWarningTemplate.id);
          setTemplates(prev => prev.filter(t => t.id !== deleteWarningTemplate.id));
          setDeleteWarningTemplate(null);
      } catch (error) {
          console.error('Error deleting template:', error);
          alert('Failed to delete template');
      }
  };

  const handleCopy = async (template: PlaygroundTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      try {
          const newTemplate: PlaygroundTemplate = {
              ...template,
              id: `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: `${template.title} (Copy)`,
              createdAt: Date.now(),
          };

          await db.savePlaygroundTemplate(newTemplate);
          setTemplates(prev => [newTemplate, ...prev]);

          // Show copy feedback
          setCopiedId(template.id);
          setTimeout(() => setCopiedId(null), 2000);
      } catch (error) {
          console.error('Error copying template:', error);
          alert('Failed to copy template');
      }
  };

  const handleAddToGame = async (template: PlaygroundTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setSelectedTemplateForGame(template);
      setGamesLoading(true);

      try {
          const gamesList = await db.fetchGames();
          const nonTemplateGames = gamesList.filter(g => !g.isGameTemplate);

          console.log('[PlaygroundManager] Fetched games:', {
              total: gamesList.length,
              nonTemplate: nonTemplateGames.length
          });

          setGames(nonTemplateGames);
          setShowGameSelector(true);
      } catch (error) {
          console.error('Error loading games:', error);
          alert('Failed to load games');
      } finally {
          setGamesLoading(false);
      }
  };

  const confirmAddToGame = async (game: Game) => {
      if (!selectedTemplateForGame) return;

      try {
          console.log('[PlaygroundManager] Starting import...', {
              template: selectedTemplateForGame.title,
              templateId: selectedTemplateForGame.id,
              taskCount: selectedTemplateForGame.tasks?.length,
              templateKeys: Object.keys(selectedTemplateForGame),
              playgroundDataPresent: !!selectedTemplateForGame.playgroundData,
              tasksPresent: !!selectedTemplateForGame.tasks,
              firstTaskKeys: selectedTemplateForGame.tasks?.[0] ? Object.keys(selectedTemplateForGame.tasks[0]) : 'no tasks',
              fullTemplate: JSON.stringify(selectedTemplateForGame, null, 2)
          });

          // VALIDATION: Check if template has tasks
          if (!selectedTemplateForGame.tasks || selectedTemplateForGame.tasks.length === 0) {
              const errorMsg = `⚠️ TEMPLATE ERROR: "${selectedTemplateForGame.title}" has no tasks!

This template may be:
• Corrupted or created before this feature
• Missing data in the database
• Not saved with tasks included

Would you like to delete this broken template?`;

              console.error('[PlaygroundManager] Template has no tasks:', selectedTemplateForGame);

              if (window.confirm(errorMsg)) {
                  try {
                      await db.deletePlaygroundTemplate(selectedTemplateForGame.id);
                      setTemplates(prev => prev.filter(t => t.id !== selectedTemplateForGame.id));
                      alert('❌ Broken template deleted.');
                  } catch (deleteError) {
                      console.error('Error deleting template:', deleteError);
                  }
              }

              setShowGameSelector(false);
              setSelectedTemplateForGame(null);
              return;
          }

          const newPlaygroundId = `pg-${Date.now()}`;

          // CRITICAL: Log playground data BEFORE import
          console.log('[PlaygroundManager] 🔍 PLAYGROUND DATA ANALYSIS (BEFORE IMPORT):', {
              hasPlaygroundData: !!selectedTemplateForGame.playgroundData,
              playgroundKeys: selectedTemplateForGame.playgroundData ? Object.keys(selectedTemplateForGame.playgroundData) : [],
              visibilitySettings: {
                  showTaskScores: selectedTemplateForGame.playgroundData?.showTaskScores,
                  showTaskOrder: selectedTemplateForGame.playgroundData?.showTaskOrder,
                  showTaskActions: selectedTemplateForGame.playgroundData?.showTaskActions,
                  showTaskNames: selectedTemplateForGame.playgroundData?.showTaskNames,
                  showTaskStatus: selectedTemplateForGame.playgroundData?.showTaskStatus,
                  showBackground: selectedTemplateForGame.playgroundData?.showBackground,
                  showQRScanner: selectedTemplateForGame.playgroundData?.showQRScanner,
                  showTitleText: selectedTemplateForGame.playgroundData?.showTitleText
              },
              fullPlaygroundData: selectedTemplateForGame.playgroundData
          });

          const newPlayground = {
              ...selectedTemplateForGame.playgroundData,  // Spread template data first
              id: newPlaygroundId,  // Then override with new unique ID (CRITICAL: must be after spread!)
              title: selectedTemplateForGame.title,
              buttonVisible: true
          };

          // CRITICAL FIX: Clear deviceLayouts.iconPositions to let tasks use their own devicePositions
          // When importing a template, we want tasks to maintain their designed positions (stored in task.devicePositions)
          // rather than being overridden by empty layout objects
          if (newPlayground.deviceLayouts) {
              Object.keys(newPlayground.deviceLayouts).forEach(deviceType => {
                  if (newPlayground.deviceLayouts![deviceType as any]) {
                      // Keep all deviceLayout properties EXCEPT iconPositions
                      const { iconPositions, ...restOfLayout } = newPlayground.deviceLayouts![deviceType as any];
                      newPlayground.deviceLayouts![deviceType as any] = restOfLayout;
                  }
              });
          }

          // VERIFICATION: Log playground after spread to verify properties are preserved
          console.log('[PlaygroundManager] ✅ PLAYGROUND DATA ANALYSIS (AFTER SPREAD):', {
              playgroundId: newPlayground.id,
              playgroundKeys: Object.keys(newPlayground),
              deviceLayoutsCleared: !!newPlayground.deviceLayouts,
              visibilitySettings: {
                  showTaskScores: newPlayground.showTaskScores,
                  showTaskOrder: newPlayground.showTaskOrder,
                  showTaskActions: newPlayground.showTaskActions,
                  showTaskNames: newPlayground.showTaskNames,
                  showTaskStatus: newPlayground.showTaskStatus,
                  showBackground: newPlayground.showBackground,
                  showQRScanner: newPlayground.showQRScanner,
                  showTitleText: newPlayground.showTitleText
              }
          });

          // CRITICAL: Log template tasks BEFORE import to verify data integrity
          console.log('[PlaygroundManager] 🔍 TEMPLATE TASKS ANALYSIS (BEFORE IMPORT):', {
              taskCount: selectedTemplateForGame.tasks.length,
              tasksWithLogic: selectedTemplateForGame.tasks.filter(t => t.logic && (t.logic.onOpen?.length || t.logic.onCorrect?.length || t.logic.onIncorrect?.length)).length,
              tasksWithSettings: selectedTemplateForGame.tasks.filter(t => t.settings).length,
              tasksWithFeedback: selectedTemplateForGame.tasks.filter(t => t.feedback).length,
              sampleTask: selectedTemplateForGame.tasks[0] ? {
                  id: selectedTemplateForGame.tasks[0].id,
                  title: selectedTemplateForGame.tasks[0].title,
                  hasLogic: !!selectedTemplateForGame.tasks[0].logic,
                  logic: selectedTemplateForGame.tasks[0].logic,
                  hasSettings: !!selectedTemplateForGame.tasks[0].settings,
                  settings: selectedTemplateForGame.tasks[0].settings,
                  hasFeedback: !!selectedTemplateForGame.tasks[0].feedback,
                  colorScheme: selectedTemplateForGame.tasks[0].colorScheme,
                  allKeys: Object.keys(selectedTemplateForGame.tasks[0])
              } : null
          });

          // ============================================================
          // CRITICAL FIX: TWO-PASS ID REMAPPING FOR TASK ACTIONS
          // ============================================================
          // PROBLEM: When copying tasks from template to game, each task gets a NEW unique ID.
          // However, task logic (onOpen/onCorrect/onIncorrect) still references the OLD template IDs.
          // SOLUTION:
          // 1. First pass: Create tasks with new IDs and build an ID mapping table
          // 2. Second pass: Update all targetId references in task logic using the map

          console.log('[PlaygroundManager] 📋 PASS 1: Creating tasks with new IDs...');

          // PASS 1: Create tasks with new IDs (but keep old targetId references for now)
          const newPointsWithOldReferences = selectedTemplateForGame.tasks.map((task, index) => {
              // Deep clone the entire task object to preserve nested structures
              const clonedTask = JSON.parse(JSON.stringify(task));

              // CRITICAL: Explicitly preserve position data from template
              const preservedPlaygroundPosition = clonedTask.playgroundPosition ? { ...clonedTask.playgroundPosition } : undefined;
              const preservedDevicePositions = clonedTask.devicePositions ? { ...clonedTask.devicePositions } : undefined;

              // Log position data for first task to verify preservation
              if (index === 0) {
                  console.log('[PlaygroundManager] 🔍 POSITION DATA CHECK (Task #0):', {
                      taskTitle: task.title,
                      hasPlaygroundPosition: !!preservedPlaygroundPosition,
                      playgroundPosition: preservedPlaygroundPosition,
                      hasDevicePositions: !!preservedDevicePositions,
                      devicePositions: preservedDevicePositions,
                      rawTaskKeys: Object.keys(task),
                      clonedTaskKeys: Object.keys(clonedTask)
                  });
              }

              // Override specific properties AFTER deep clone
              // CRITICAL: Explicitly include position data to ensure it's preserved
              return {
                  ...clonedTask,
                  id: `task-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
                  playgroundId: newPlaygroundId, // Associate with new playground
                  playgroundPosition: preservedPlaygroundPosition, // EXPLICIT: Preserve legacy position
                  devicePositions: preservedDevicePositions, // EXPLICIT: Preserve device-specific positions
                  order: index,
                  isCompleted: false, // Reset completion status
                  isUnlocked: true // Unlock by default
              };
          });

          // Create ID mapping table: oldTemplateId -> newGameId
          console.log('[PlaygroundManager] 🗺️ Creating ID mapping table...');
          const idMap = createTaskIdMap(selectedTemplateForGame.tasks, newPointsWithOldReferences);

          // PASS 2: Remap all targetId references in task logic
          console.log('[PlaygroundManager] 🔄 PASS 2: Remapping targetId references in task logic...');
          const newPoints = remapTaskLogicTargets(newPointsWithOldReferences, idMap);

          // VALIDATION: Verify all references are valid
          console.log('[PlaygroundManager] ✅ VALIDATION: Checking task references...');
          const validation = validateTaskReferences(newPoints);

          if (!validation.valid) {
              console.error('[PlaygroundManager] ❌ VALIDATION FAILED:', validation.errors);
              validation.errors.forEach(err => console.error(`   • ${err}`));
          }

          if (validation.warnings.length > 0) {
              console.warn('[PlaygroundManager] ⚠️ VALIDATION WARNINGS:', validation.warnings);
              validation.warnings.forEach(warn => console.warn(`   • ${warn}`));
          }

          if (validation.valid) {
              console.log('[PlaygroundManager] ✅ ALL TASK REFERENCES ARE VALID!');
          }

          // CRITICAL: Log imported tasks AFTER processing to verify all properties are preserved
          const tasksWithPositions = newPoints.filter(t => t.playgroundPosition || t.devicePositions);
          console.log('[PlaygroundManager] ✅ IMPORTED TASKS ANALYSIS (AFTER IMPORT):', {
              count: newPoints.length,
              tasksWithLogic: newPoints.filter(t => t.logic && (t.logic.onOpen?.length || t.logic.onCorrect?.length || t.logic.onIncorrect?.length)).length,
              tasksWithSettings: newPoints.filter(t => t.settings).length,
              tasksWithFeedback: newPoints.filter(t => t.feedback).length,
              tasksWithPositions: tasksWithPositions.length,
              positionCoverage: `${Math.round((tasksWithPositions.length / newPoints.length) * 100)}%`,
              firstTask: newPoints[0] ? {
                  id: newPoints[0].id,
                  title: newPoints[0].title,
                  hasLogic: !!newPoints[0].logic,
                  logic: newPoints[0].logic,
                  hasSettings: !!newPoints[0].settings,
                  settings: newPoints[0].settings,
                  hasFeedback: !!newPoints[0].feedback,
                  hasPlaygroundPosition: !!newPoints[0].playgroundPosition,
                  playgroundPosition: newPoints[0].playgroundPosition,
                  hasDevicePositions: !!newPoints[0].devicePositions,
                  devicePositions: newPoints[0].devicePositions,
                  colorScheme: newPoints[0].colorScheme,
                  allKeys: Object.keys(newPoints[0])
              } : null,
              logicComparison: selectedTemplateForGame.tasks[0]?.logic === newPoints[0]?.logic ? '✅ Same object' : '⚠️ Different objects (expected due to spread)'
          });

          // VERIFICATION: Warn if position data was lost
          if (tasksWithPositions.length === 0 && newPoints.length > 0) {
              console.error('[PlaygroundManager] ⚠️ CRITICAL: ALL POSITION DATA WAS LOST DURING IMPORT!', {
                  templateTasksWithPositions: selectedTemplateForGame.tasks.filter((t: any) => t.playgroundPosition || t.devicePositions).length,
                  importedTasksWithPositions: tasksWithPositions.length
              });
          } else if (tasksWithPositions.length < newPoints.length) {
              console.warn('[PlaygroundManager] ⚠️ WARNING: Some position data was lost:', {
                  expected: selectedTemplateForGame.tasks.filter((t: any) => t.playgroundPosition || t.devicePositions).length,
                  actual: tasksWithPositions.length
              });
          } else {
              console.log('[PlaygroundManager] ✅ Position data preserved successfully!');
          }

          const updatedGame = {
              ...game,
              playgrounds: [...(game.playgrounds || []), newPlayground],
              points: [...(game.points || []), ...newPoints] // Add the imported tasks to game points
          };

          console.log('[PlaygroundManager] BEFORE SAVE - Updated game:', {
              gameId: game.id,
              originalPlaygroundCount: game.playgrounds?.length || 0,
              originalPointCount: game.points?.length || 0,
              newPlaygroundCount: updatedGame.playgrounds.length,
              newPointCount: updatedGame.points.length,
              newPointsArray: newPoints.map(p => ({ id: p.id, title: p.title, playgroundId: p.playgroundId })),
              newPlaygroundId: newPlayground.id
          });

          await db.saveGame(updatedGame);

          console.log('[PlaygroundManager] AFTER SAVE - Game saved successfully', {
              gameId: game.id,
              playgroundCount: updatedGame.playgrounds.length,
              pointCount: updatedGame.points.length
          });

          // CRITICAL FIX: Update the local games state with the fresh data
          // This ensures that if the user opens the game editor immediately,
          // they will see the newly imported playzone and tasks
          setGames(prevGames => prevGames.map(g =>
              g.id === updatedGame.id ? updatedGame : g
          ));

          // Notify parent component (App.tsx) about the game update
          // This ensures the global games state is also refreshed
          if (onGameUpdated) {
              onGameUpdated(updatedGame);
              console.log('[PlaygroundManager] ✅ Parent notified of game update');
          }

          console.log('[PlaygroundManager] ✅ Local games state updated with imported tasks');

          setShowGameSelector(false);
          setSelectedTemplateForGame(null);
          setSuccessMessage({
              template: selectedTemplateForGame.title,
              game: game.name,
              taskCount: newPoints.length
          });
      } catch (error) {
          console.error('[PlaygroundManager] Error adding playzone to game:', error);
          alert(`❌ Failed to add playzone to game:\n\n${error}`);
      }
  };

  // Helper functions for categorizing games
  const getTodayGames = () => {
      return games.filter(g => {
          const gameDate = new Date(g.createdAt);
          const now = new Date();
          return gameDate.toDateString() === now.toDateString() || g.state === 'active';
      });
  };

  const getPlannedGames = () => {
      return games.filter(g => {
          const gameDate = new Date(g.createdAt);
          const now = new Date();
          return gameDate.toDateString() !== now.toDateString() && gameDate > now && g.state !== 'active' && g.state !== 'ended' && g.state !== 'ending';
      });
  };

  const getCompletedGames = () => {
      // Show games that are ended/ending, or old games without a state field
      return games.filter(g => g.state === 'ended' || g.state === 'ending' || !g.state);
  };

  const getActiveTabGames = () => {
      if (activeTab === 'TODAY') return getTodayGames();
      if (activeTab === 'PLANNED') return getPlannedGames();
      if (activeTab === 'COMPLETED') return getCompletedGames();
      return [];
  };

  return (
    <div className="fixed inset-0 z-[4500] bg-slate-950 text-white flex flex-col font-sans overflow-hidden animate-in fade-in">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)] opacity-40 pointer-events-none" />
        
        {/* Header */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-xl z-10 sticky top-0">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
                    <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight uppercase leading-none">GLOBAL PLAYZONES</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">TEMPLATE LIBRARY</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all hover:scale-105 active:scale-95">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-0">
            <div className="max-w-[1920px] mx-auto">
                <div className="mb-8 space-y-4">
                    <button
                        onClick={onCreate}
                        className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center gap-3 text-slate-500 hover:text-indigo-500 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group hover:scale-[1.01]"
                    >
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 group-hover:border-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all group-hover:scale-110">
                            <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-black uppercase tracking-widest text-sm">CREATE NEW TEMPLATE</span>
                    </button>

                    {/* Template Validation Button */}
                    <button
                        onClick={async () => {
                            const validation = await db.validatePlaygroundTemplates();

                            if (validation.broken === 0) {
                                alert(`✅ ALL TEMPLATES VALID!\n\n${validation.total} template(s) checked.\nAll templates have tasks and playground data.`);
                            } else {
                                const brokenList = validation.brokenTemplates.map(t => `• ${t.title} - ${t.issue}`).join('\n');
                                const confirmDelete = window.confirm(
                                    `⚠️ FOUND ${validation.broken} BROKEN TEMPLATE(S):\n\n${brokenList}\n\n` +
                                    `Valid templates: ${validation.valid}\n` +
                                    `Broken templates: ${validation.broken}\n\n` +
                                    `Would you like to DELETE all broken templates?\n\n` +
                                    `(This cannot be undone)`
                                );

                                if (confirmDelete) {
                                    for (const broken of validation.brokenTemplates) {
                                        await db.deletePlaygroundTemplate(broken.id);
                                    }
                                    await loadTemplates();
                                    alert(`✅ Deleted ${validation.broken} broken template(s).`);
                                }
                            }
                        }}
                        className="w-full py-3 bg-yellow-600/10 border border-yellow-600/30 hover:border-yellow-500 rounded-xl flex items-center justify-center gap-3 text-yellow-500 hover:bg-yellow-600/20 transition-all group"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-widest text-xs">VALIDATE TEMPLATES</span>
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">LOADING LIBRARY...</span>
                    </div>
                ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                        <LayoutGrid className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-black uppercase tracking-[0.2em] text-sm">NO TEMPLATES FOUND</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {templates.map(tpl => (
                            <div 
                                key={tpl.id}
                                className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-indigo-500/10 transition-all flex flex-col relative hover:-translate-y-2 hover:scale-[1.01]"
                            >
                                {/* Card Body (Click to Edit) */}
                                <div onClick={() => onEdit(tpl)} className="cursor-pointer">
                                    <div className="h-40 bg-slate-800 relative overflow-hidden group-hover:brightness-110 transition-all">
                                        {tpl.playgroundData.imageUrl ? (
                                            <img src={tpl.playgroundData.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt={tpl.title} />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                                <ImageIcon className="w-12 h-12 text-slate-500" />
                                            </div>
                                        )}
                                        <div className={`absolute top-3 left-3 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border shadow-md ${
                                            (!tpl.tasks || tpl.tasks.length === 0) ? 'bg-red-600/80 border-red-400/30' : 'bg-black/60 border-white/10'
                                        }`}>
                                            {tpl.tasks?.length || 0} TASKS {(!tpl.tasks || tpl.tasks.length === 0) && '⚠️'}
                                        </div>
                                        <div className="absolute top-3 right-3 flex gap-2">
                                            <button
                                                onClick={(e) => handleCopy(tpl, e)}
                                                className={`p-2 rounded-lg transition-all border border-white/10 hover:scale-110 z-50 shadow-lg cursor-pointer flex items-center justify-center ${
                                                    copiedId === tpl.id
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }`}
                                                title="Copy Template"
                                            >
                                                {copiedId === tpl.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={(e) => handleAddToGame(tpl, e)}
                                                className="p-2 bg-purple-600 text-white rounded-lg transition-all border border-white/10 hover:scale-110 hover:bg-purple-700 z-50 shadow-lg cursor-pointer flex items-center justify-center"
                                                title="Add to Game"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(tpl, e)}
                                                className="p-2 bg-red-600 text-white rounded-lg transition-all border border-white/10 hover:scale-110 hover:bg-red-700 z-50 shadow-lg cursor-pointer flex items-center justify-center"
                                                title="Delete Template"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col justify-end">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight mb-1 truncate group-hover:text-indigo-400 transition-colors">{tpl.title}</h3>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                            Created: {new Date(tpl.createdAt).toLocaleDateString()}
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                            <Edit2 className="w-3 h-3" /> EDIT TEMPLATE
                                        </div>
                                    </div>
                                </div>

                                {/* Use In Game Button */}
                                {onUseInGame && (
                                    <div className="p-4 pt-0 border-t border-white/5 bg-[#0a0f1e]">
                                        <button 
                                            onClick={() => onUseInGame(tpl)}
                                            className="w-full py-3 mt-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95"
                                        >
                                            <PlayCircle className="w-4 h-4" /> USE IN GAME
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* GAME SELECTOR MODAL */}
        {showGameSelector && selectedTemplateForGame && (
            <div className="fixed inset-0 z-[5000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto animate-in fade-in">
                <div className="bg-slate-900 border-2 border-purple-600 rounded-2xl shadow-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto animate-in zoom-in-95 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-purple-600/20 border border-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Plus className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">ADD TO GAME</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Select which game to add "{selectedTemplateForGame.title}"</p>
                        </div>
                    </div>

                    {/* TAB BAR */}
                    <div className="flex gap-3 mb-6 border-b border-slate-800">
                        <button
                            onClick={() => setActiveTab('TODAY')}
                            className={`px-6 py-3 font-black uppercase text-xs tracking-widest border-b-2 transition-all ${
                                activeTab === 'TODAY'
                                    ? 'border-purple-500 text-purple-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            TODAY
                        </button>
                        <button
                            onClick={() => setActiveTab('PLANNED')}
                            className={`px-6 py-3 font-black uppercase text-xs tracking-widest border-b-2 transition-all ${
                                activeTab === 'PLANNED'
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            PLANNED
                        </button>
                        <button
                            onClick={() => setActiveTab('COMPLETED')}
                            className={`px-6 py-3 font-black uppercase text-xs tracking-widest border-b-2 transition-all ${
                                activeTab === 'COMPLETED'
                                    ? 'border-green-500 text-green-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            COMPLETED
                        </button>
                    </div>

                    {/* CONTENT */}
                    <div className="flex-1 mb-6">
                        {gamesLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
                                <span className="text-xs font-bold text-slate-400 uppercase">LOADING GAMES...</span>
                            </div>
                        ) : games.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-400">No games available. Create a game first.</p>
                            </div>
                        ) : getActiveTabGames().length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-400">
                                    No {activeTab.toLowerCase()} games available.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {getActiveTabGames().map(game => {
                                    const tabColorMap = {
                                        'TODAY': { bg: 'bg-purple-900/30', hover: 'hover:bg-purple-900/50', border: 'border-purple-600/50 hover:border-purple-500', text: 'group-hover:text-purple-300', shadow: 'hover:shadow-purple-500/20' },
                                        'PLANNED': { bg: 'bg-blue-900/30', hover: 'hover:bg-blue-900/50', border: 'border-blue-600/50 hover:border-blue-500', text: 'group-hover:text-blue-300', shadow: 'hover:shadow-blue-500/20' },
                                        'COMPLETED': { bg: 'bg-green-900/30', hover: 'hover:bg-green-900/50', border: 'border-green-600/50 hover:border-green-500', text: 'group-hover:text-green-300', shadow: 'hover:shadow-green-500/20' }
                                    };
                                    const colors = tabColorMap[activeTab];

                                    // Get game type badge info
                                    const gameModeIcons = {
                                        'standard': { label: 'GPS', color: 'bg-blue-600 text-blue-100' },
                                        'playzone': { label: 'PLAYZONE', color: 'bg-purple-600 text-purple-100' },
                                        'elimination': { label: 'CTF', color: 'bg-red-600 text-red-100' }
                                    };
                                    const modeInfo = gameModeIcons[game.gameMode as keyof typeof gameModeIcons] || { label: 'STANDARD', color: 'bg-slate-600 text-slate-100' };

                                    return (
                                        <button
                                            key={game.id}
                                            onClick={() => confirmAddToGame(game)}
                                            className={`text-left p-4 ${colors.bg} ${colors.hover} border ${colors.border} rounded-lg transition-all hover:shadow-lg ${colors.shadow} group relative`}
                                        >
                                            {/* Game Type Badge */}
                                            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${modeInfo.color}`}>
                                                {modeInfo.label}
                                            </div>

                                            <h3 className={`font-bold text-white uppercase text-sm mb-1 ${colors.text} transition-colors pr-14`}>{game.name}</h3>
                                            <p className="text-xs text-slate-400 mb-2">{game.points?.length || 0} tasks • {game.playgrounds?.length || 0} zones</p>
                                            <p className="text-xs text-slate-500">
                                                {game.client?.name ? `By ${game.client.name}` : 'No client assigned'}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            setShowGameSelector(false);
                            setSelectedTemplateForGame(null);
                            setActiveTab('TODAY');
                        }}
                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg uppercase tracking-widest text-sm transition-colors"
                    >
                        CANCEL
                    </button>
                </div>
            </div>
        )}

        {/* DELETE WARNING MODAL */}
        {deleteWarningTemplate && (
            <div className="fixed inset-0 z-[5000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto animate-in fade-in">
                <div className="bg-slate-900 border-2 border-red-600 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-red-600/20 border border-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">DELETE TEMPLATE?</h2>
                    </div>

                    <div className="space-y-3 mb-6">
                        <p className="text-sm text-slate-300">
                            You are about to <span className="font-bold text-red-400">permanently delete</span> the playzone template:
                        </p>
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                            <p className="font-bold text-white text-sm uppercase tracking-wide">{deleteWarningTemplate.title}</p>
                            <p className="text-xs text-slate-400 mt-1">
                                {deleteWarningTemplate.tasks.length} tasks • Created {new Date(deleteWarningTemplate.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3">
                            <p className="text-xs font-bold text-red-300 uppercase tracking-wide flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4" /> WARNING
                            </p>
                            <ul className="text-xs text-red-200/80 space-y-1">
                                <li>• This action cannot be undone</li>
                                <li>• All games using this template will retain their copies</li>
                                <li>• The template will be removed from the library</li>
                            </ul>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setDeleteWarningTemplate(null)}
                            className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg uppercase tracking-widest text-sm transition-colors"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg uppercase tracking-widest text-sm transition-colors shadow-lg shadow-red-600/50 active:scale-95"
                        >
                            DELETE PERMANENTLY
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* SUCCESS MODAL */}
        {successMessage && (
            <div className="fixed inset-0 z-[5000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto animate-in fade-in">
                <div className="bg-slate-900 border-2 border-green-600 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-green-600/20 border border-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">SUCCESS!</h2>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-4">
                            <p className="text-sm text-green-200 mb-3">
                                Playzone <span className="font-bold text-green-100">"{successMessage.template}"</span> with <span className="font-bold text-green-100">{successMessage.taskCount} task{successMessage.taskCount !== 1 ? 's' : ''}</span> added to <span className="font-bold text-green-100">"{successMessage.game}"</span>!
                            </p>
                            <p className="text-xs text-green-300/80">
                                Go to the Game Editor to see the imported tasks.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg uppercase tracking-widest text-sm transition-colors shadow-lg shadow-green-600/50 active:scale-95"
                    >
                        OK
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default PlaygroundManager;
