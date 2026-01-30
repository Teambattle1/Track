/**
 * AroundTheWorldDashboard - Instructor dashboard for Around The World game
 * Victorian 1880 themed interface for managing sessions, teams, and gameplay
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Game, Team, ChatMessage, Destination, GamePoint, TaskTemplate } from '../../types';
import { VICTORIAN_TEAM_NAMES, VictorianTeamName, getAvailableTeamNames } from '../../utils/aroundtheworld/teamNames';
import { JORDEN80_CITIES } from '../../utils/jorden80/europeData';
import { ARW_DEFAULT_TASKS, getTasksForCity, getAllARWTasks, CityTaskSet } from '../../utils/aroundtheworld/defaultTasks';
import { atwSync } from '../../services/aroundTheWorldSync';
import EuropeMapCanvas from '../jorden80/EuropeMapCanvas';
import './styles/victorian-theme.css';
import {
  X, Play, Pause, Users, MessageSquare, Map, List, Settings,
  Plus, Trash2, ChevronDown, ChevronRight, Send, Clock, Check, Search, Library
} from 'lucide-react';

interface AroundTheWorldDashboardProps {
  game?: Game;
  teams: Team[];
  onCreateSession: (name: string, config: any) => void;
  onStartGame: () => void;
  onPauseGame: () => void;
  onSendChat: (message: string, teamId?: string) => void;
  onUpdateGame: (game: Game) => void;
  onClose: () => void;
  chatMessages: ChatMessage[];
  taskLibrary: GamePoint[];
  onAddTaskToCity: (cityId: string, taskId: string) => void;
  onRemoveTaskFromCity: (cityId: string, taskId: string) => void;
}

const AroundTheWorldDashboard: React.FC<AroundTheWorldDashboardProps> = ({
  game,
  teams,
  onCreateSession,
  onStartGame,
  onPauseGame,
  onSendChat,
  onUpdateGame,
  onClose,
  chatMessages,
  taskLibrary,
  onAddTaskToCity,
  onRemoveTaskFromCity
}) => {
  // State
  const [sessionName, setSessionName] = useState(game?.name || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'editor' | 'teams'>('overview');
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [selectedChatTeam, setSelectedChatTeam] = useState<string | null>(null);
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set(['london']));
  const [isGameRunning, setIsGameRunning] = useState(game?.state === 'active');
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [selectedCityForTask, setSelectedCityForTask] = useState<string | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [realtimeTeams, setRealtimeTeams] = useState<Team[]>(teams);

  // Connect to real-time sync when game is active
  useEffect(() => {
    if (game?.id) {
      try {
        atwSync.connect(game.id).catch(err => {
          console.error('[ATW Dashboard] Failed to connect to sync:', err);
        });
        const unsubscribe = atwSync.onTeamsUpdate((updatedTeams) => {
          setRealtimeTeams(updatedTeams);
        });
        return () => {
          unsubscribe();
          atwSync.disconnect().catch(err => {
            console.error('[ATW Dashboard] Failed to disconnect:', err);
          });
        };
      } catch (err) {
        console.error('[ATW Dashboard] Error setting up sync:', err);
      }
    }
  }, [game?.id]);

  // Keep realtimeTeams in sync with props when props change
  useEffect(() => {
    setRealtimeTeams(teams);
  }, [teams]);

  // Get taken team names from current teams (use real-time data)
  const takenTeamNames = useMemo(() => {
    return realtimeTeams.map(t => t.name);
  }, [realtimeTeams]);

  // Get tasks grouped by city
  const tasksByCity = useMemo(() => {
    const grouped: Record<string, GamePoint[]> = {};
    JORDEN80_CITIES.forEach(city => {
      grouped[city.id] = (game?.points || []).filter(p => p.destinationId === city.id);
    });
    return grouped;
  }, [game?.points]);

  // Handle session creation
  const handleCreateSession = () => {
    if (!sessionName.trim()) return;
    onCreateSession(sessionName, {
      theme: 'victorian',
      enableDaysTracking: true,
      daysLimit: 80,
      enableBranchingRoutes: true
    });
  };

  // Handle chat send
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    onSendChat(chatInput, selectedChatTeam || undefined);
    setChatInput('');
  };

  // Toggle city expansion
  const toggleCity = (cityId: string) => {
    setExpandedCities(prev => {
      const next = new Set(prev);
      if (next.has(cityId)) {
        next.delete(cityId);
      } else {
        next.add(cityId);
      }
      return next;
    });
  };

  // Format time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render session setup (no game yet)
  const renderSessionSetup = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="atw-card p-8 max-w-lg w-full">
        <h2 className="atw-font-heading-sc text-2xl text-center mb-2" style={{ color: 'var(--atw-ink-brown)' }}>
          Create New Expedition
        </h2>
        <p className="atw-font-elegant text-center mb-6" style={{ color: 'var(--atw-sepia)' }}>
          Embark on a journey around the world in 80 days
        </p>

        <div className="atw-divider" />

        <div className="space-y-4">
          <div>
            <label className="atw-font-heading text-sm block mb-2" style={{ color: 'var(--atw-ink-brown)' }}>
              Expedition Name
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Reform Club Challenge 2026"
              className="atw-input w-full"
            />
          </div>

          <div className="atw-ornament">✦</div>

          <button
            onClick={handleCreateSession}
            disabled={!sessionName.trim()}
            className="atw-btn atw-btn-primary w-full"
          >
            <Play className="w-4 h-4 inline mr-2" />
            Begin Expedition
          </button>
        </div>
      </div>
    </div>
  );

  // Render overview tab
  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Game Status */}
      <div className="atw-card p-6">
        <h3 className="atw-font-heading-sc text-lg mb-4" style={{ color: 'var(--atw-ink-brown)' }}>
          Expedition Status
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="atw-font-body">Status</span>
            <span className={`atw-font-heading px-3 py-1 rounded-full text-sm ${
              isGameRunning
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isGameRunning ? 'IN PROGRESS' : 'PAUSED'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="atw-font-body">Teams</span>
            <span className="atw-font-heading">{realtimeTeams.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="atw-font-body">Cities</span>
            <span className="atw-font-heading">{JORDEN80_CITIES.length}</span>
          </div>
        </div>

        <div className="atw-divider" />

        <div className="flex gap-2">
          {isGameRunning ? (
            <button
              onClick={() => { setIsGameRunning(false); onPauseGame(); }}
              className="atw-btn atw-btn-secondary flex-1"
            >
              <Pause className="w-4 h-4 inline mr-2" />
              Pause
            </button>
          ) : (
            <button
              onClick={() => { setIsGameRunning(true); onStartGame(); }}
              className="atw-btn atw-btn-primary flex-1"
            >
              <Play className="w-4 h-4 inline mr-2" />
              Start
            </button>
          )}
        </div>
      </div>

      {/* Teams List */}
      <div className="atw-card p-6">
        <h3 className="atw-font-heading-sc text-lg mb-4" style={{ color: 'var(--atw-ink-brown)' }}>
          <Users className="w-5 h-5 inline mr-2" />
          Participating Teams
        </h3>
        {realtimeTeams.length === 0 ? (
          <p className="atw-font-elegant text-center py-8" style={{ color: 'var(--atw-sepia)' }}>
            No teams have joined yet...
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {realtimeTeams.map(team => {
              const victorianName = VICTORIAN_TEAM_NAMES.find(t => t.name === team.name);
              return (
                <div
                  key={team.id}
                  className="flex items-center gap-3 p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--atw-parchment-light)' }}
                >
                  <span className="text-xl">{victorianName?.icon || '👤'}</span>
                  <div className="flex-1">
                    <div className="atw-font-heading text-sm">{team.name}</div>
                    <div className="atw-font-body text-xs" style={{ color: 'var(--atw-sepia)' }}>
                      Score: {team.score} pts
                    </div>
                  </div>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: team.color || victorianName?.color }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="atw-card p-6">
        <h3 className="atw-font-heading-sc text-lg mb-4" style={{ color: 'var(--atw-ink-brown)' }}>
          Quick Actions
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => setActiveTab('map')}
            className="atw-btn atw-btn-secondary w-full text-left"
          >
            <Map className="w-4 h-4 inline mr-2" />
            View Map
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className="atw-btn atw-btn-secondary w-full text-left"
          >
            <List className="w-4 h-4 inline mr-2" />
            Edit Cities & Tasks
          </button>
          <button
            onClick={() => setShowChat(true)}
            className="atw-btn atw-btn-secondary w-full text-left"
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Open Telegram
          </button>
        </div>
      </div>
    </div>
  );

  // Render map view
  const renderMapView = () => (
    <div className="p-6">
      <div className="atw-card overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <EuropeMapCanvas
          teams={teams}
          currentTeamId={undefined}
          teamProgress={game?.jorden80TeamProgress || {}}
          showAllTeams={true}
          width={1200}
          height={700}
        />
      </div>
    </div>
  );

  // Render editor view
  const renderEditorView = () => (
    <div className="flex h-full">
      {/* Cities List */}
      <div className="w-1/3 atw-editor-panel">
        <div className="p-4 border-b-2" style={{ borderColor: 'var(--atw-sepia)' }}>
          <h3 className="atw-font-heading-sc text-lg" style={{ color: 'var(--atw-ink-brown)' }}>
            Cities & Tasks
          </h3>
        </div>
        <div className="atw-city-list">
          {JORDEN80_CITIES.map(city => (
            <div key={city.id} className="atw-city-item">
              <div
                className="atw-city-header"
                onClick={() => toggleCity(city.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedCities.has(city.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="atw-city-name">{city.name}</span>
                </div>
                <span className="atw-city-flag">{city.flagEmoji}</span>
              </div>

              {expandedCities.has(city.id) && (
                <div className="atw-city-tasks">
                  {tasksByCity[city.id]?.length === 0 ? (
                    <p className="atw-font-elegant text-sm text-center py-2" style={{ color: 'var(--atw-sepia)' }}>
                      No tasks assigned
                    </p>
                  ) : (
                    tasksByCity[city.id]?.map(task => (
                      <div key={task.id} className="atw-task-item">
                        <span className={`atw-task-type ${task.jorden80TaskType || 'by'}`}>
                          {task.jorden80TaskType || 'TASK'}
                        </span>
                        <span className="flex-1 truncate">{task.title}</span>
                        <button
                          onClick={() => onRemoveTaskFromCity(city.id, task.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => openTaskSelectorForCity(city.id)}
                    className="w-full mt-2 p-2 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 hover:bg-white/50 transition-colors"
                    style={{ borderColor: 'var(--atw-sepia-light)', color: 'var(--atw-sepia)' }}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="atw-font-body text-sm">Add Task</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Map Preview */}
      <div className="flex-1 p-6">
        <div className="atw-card overflow-hidden h-full">
          <EuropeMapCanvas
            teams={teams}
            currentTeamId={undefined}
            teamProgress={game?.jorden80TeamProgress || {}}
            showAllTeams={true}
            width={800}
            height={500}
          />
        </div>
      </div>
    </div>
  );

  // Render teams view
  const renderTeamsView = () => (
    <div className="p-6">
      <div className="atw-card p-6">
        <h3 className="atw-font-heading-sc text-xl mb-4" style={{ color: 'var(--atw-ink-brown)' }}>
          Team Management
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {realtimeTeams.map(team => {
            const victorianName = VICTORIAN_TEAM_NAMES.find(t => t.name === team.name);
            const progress = game?.jorden80TeamProgress?.[team.id];

            return (
              <div key={team.id} className="atw-panel p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{victorianName?.icon || '👤'}</span>
                  <div>
                    <h4 className="atw-font-heading">{team.name}</h4>
                    <p className="atw-font-elegant text-sm" style={{ color: 'var(--atw-sepia)' }}>
                      {victorianName?.motto}
                    </p>
                  </div>
                </div>
                <div className="atw-divider" />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="atw-font-body" style={{ color: 'var(--atw-sepia)' }}>Score:</span>
                    <span className="atw-font-heading ml-2">{team.score}</span>
                  </div>
                  <div>
                    <span className="atw-font-body" style={{ color: 'var(--atw-sepia)' }}>Days:</span>
                    <span className="atw-font-heading ml-2">{progress?.daysUsed || 0}</span>
                  </div>
                  <div>
                    <span className="atw-font-body" style={{ color: 'var(--atw-sepia)' }}>Location:</span>
                    <span className="atw-font-heading ml-2">{progress?.currentCity || 'London'}</span>
                  </div>
                  <div>
                    <span className="atw-font-body" style={{ color: 'var(--atw-sepia)' }}>Members:</span>
                    <span className="atw-font-heading ml-2">{team.members?.length || 0}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Get all default tasks as a flat list for the task selector
  const allDefaultTasks = useMemo(() => getAllARWTasks(), []);

  // Filter tasks for the selector
  const filteredTasks = useMemo(() => {
    const currentCityTasks = tasksByCity[selectedCityForTask || ''] || [];
    const currentTaskIds = new Set(currentCityTasks.map(t => t.id));

    return allDefaultTasks.filter(task => {
      // Don't show tasks already assigned to this city
      if (currentTaskIds.has(task.id)) return false;
      // Filter by search query
      if (taskSearchQuery) {
        const query = taskSearchQuery.toLowerCase();
        return (
          task.title.toLowerCase().includes(query) ||
          task.task.question.toLowerCase().includes(query) ||
          task.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [allDefaultTasks, selectedCityForTask, tasksByCity, taskSearchQuery]);

  // Open task selector for a city
  const openTaskSelectorForCity = (cityId: string) => {
    setSelectedCityForTask(cityId);
    setTaskSearchQuery('');
    setShowTaskSelector(true);
  };

  // Handle adding a task from the selector
  const handleAddTaskFromSelector = (task: TaskTemplate) => {
    if (selectedCityForTask) {
      onAddTaskToCity(selectedCityForTask, task.id);
    }
    setShowTaskSelector(false);
    setSelectedCityForTask(null);
  };

  // Render task selector modal
  const renderTaskSelector = () => {
    const cityName = JORDEN80_CITIES.find(c => c.id === selectedCityForTask)?.name || 'City';

    return (
      <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <div className="atw-card max-w-2xl w-full max-h-[80vh] flex flex-col atw-animate-in">
          {/* Header */}
          <div className="p-4 border-b-2" style={{ borderColor: 'var(--atw-sepia)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="atw-font-heading-sc text-xl" style={{ color: 'var(--atw-ink-brown)' }}>
                <Library className="w-5 h-5 inline mr-2" />
                Add Task to {cityName}
              </h3>
              <button
                onClick={() => setShowTaskSelector(false)}
                className="p-1 rounded hover:bg-black/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--atw-sepia)' }} />
              <input
                type="text"
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="atw-input w-full pl-10"
              />
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredTasks.length === 0 ? (
              <p className="atw-font-elegant text-center py-8" style={{ color: 'var(--atw-sepia)' }}>
                No tasks available. All tasks may already be assigned to this city.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => handleAddTaskFromSelector(task)}
                    className="p-3 rounded-lg cursor-pointer transition-all hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--atw-parchment-light)',
                      border: '1px solid var(--atw-sepia-light)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{task.iconId === 'camera' ? '📷' : task.iconId === 'world' ? '🌍' : '❓'}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded atw-task-type ${task.tags?.includes('by') ? 'by' : task.tags?.includes('land') ? 'land' : 'creative'}`}>
                            {task.tags?.includes('by') ? 'BY' : task.tags?.includes('land') ? 'LAND' : 'CREATIVE'}
                          </span>
                          <span className="atw-font-heading text-sm">{task.title}</span>
                        </div>
                        <p className="atw-font-body text-sm" style={{ color: 'var(--atw-sepia)' }}>
                          {task.task.question.slice(0, 100)}{task.task.question.length > 100 ? '...' : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs" style={{ color: 'var(--atw-gold)' }}>
                            {task.points} pts
                          </span>
                          {task.tags?.map(tag => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--atw-sepia-light)', color: 'var(--atw-ink-brown)' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Plus className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--atw-gold)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t-2" style={{ borderColor: 'var(--atw-sepia)', backgroundColor: 'var(--atw-parchment-dark)' }}>
            <p className="atw-font-body text-sm text-center" style={{ color: 'var(--atw-sepia)' }}>
              {filteredTasks.length} tasks available • Click to add
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render chat popup
  const renderChatPopup = () => (
    <div className="atw-chat-popup atw-animate-in">
      <div className="atw-chat-header">
        <span className="atw-chat-title">
          <MessageSquare className="w-4 h-4 inline mr-2" />
          TELEGRAM
        </span>
        <button onClick={() => setShowChat(false)} className="hover:opacity-75">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Team selector */}
      <div className="p-2 border-b" style={{ borderColor: 'var(--atw-sepia-light)', backgroundColor: 'var(--atw-parchment-dark)' }}>
        <select
          value={selectedChatTeam || ''}
          onChange={(e) => setSelectedChatTeam(e.target.value || null)}
          className="atw-input w-full text-sm py-1"
        >
          <option value="">All Teams (Broadcast)</option>
          {realtimeTeams.map(team => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </div>

      <div className="atw-chat-messages">
        {chatMessages.length === 0 ? (
          <p className="atw-font-elegant text-center py-8" style={{ color: 'var(--atw-sepia)' }}>
            No telegrams yet...
          </p>
        ) : (
          chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`atw-chat-message ${msg.sender === 'Instructor' ? 'instructor' : 'team'}`}
            >
              <div className="atw-chat-sender">{msg.sender}</div>
              <div className="atw-chat-text">{msg.message}</div>
              <div className="atw-chat-time">{formatTime(msg.timestamp)}</div>
            </div>
          ))
        )}
      </div>

      <div className="atw-chat-input-area">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
          placeholder="Compose telegram..."
          className="atw-chat-input"
        />
        <button onClick={handleSendChat} className="atw-chat-send">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="atw-container fixed inset-0 z-[5000] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="atw-header flex items-center justify-between">
        <div>
          <h1 className="atw-title">
            {game?.name || 'Around The World'}
          </h1>
          <p className="atw-subtitle">
            The Great Victorian Expedition of {new Date().getFullYear()}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {game && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Clock className="w-4 h-4" />
              <span className="atw-font-heading text-sm">
                {realtimeTeams.length} Teams
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      {game && (
        <div className="flex gap-1 px-6 pt-4" style={{ backgroundColor: 'var(--atw-parchment-dark)' }}>
          {[
            { id: 'overview', label: 'Overview', icon: Settings },
            { id: 'map', label: 'Map', icon: Map },
            { id: 'editor', label: 'Editor', icon: List },
            { id: 'teams', label: 'Teams', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-t-lg flex items-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'atw-font-heading'
                  : 'atw-font-body hover:bg-white/30'
              }`}
              style={{
                backgroundColor: activeTab === tab.id ? 'var(--atw-parchment)' : 'transparent',
                color: activeTab === tab.id ? 'var(--atw-ink-brown)' : 'var(--atw-sepia)'
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--atw-parchment)' }}>
        {!game ? (
          renderSessionSetup()
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'map' && renderMapView()}
            {activeTab === 'editor' && renderEditorView()}
            {activeTab === 'teams' && renderTeamsView()}
          </>
        )}
      </div>

      {/* Chat Popup */}
      {showChat && renderChatPopup()}

      {/* Task Selector Modal */}
      {showTaskSelector && renderTaskSelector()}

      {/* Chat Toggle Button (when closed) */}
      {!showChat && game && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center atw-pulse"
          style={{
            backgroundColor: 'var(--atw-gold)',
            color: 'var(--atw-ink-black)',
            boxShadow: 'var(--atw-shadow-lg)'
          }}
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default AroundTheWorldDashboard;
