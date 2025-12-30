import React, { useState } from 'react';
import { GamePoint, GameAction, TaskLogic, ActionType, Playground } from '../types';
import { X, Plus, Trash2, Zap, CheckCircle, XCircle, Unlock, Lock, Eye, MessageSquare, Music, Coins, Save, ArrowRight, Skull, PenTool, LayoutGrid, Info } from 'lucide-react';

interface TaskActionModalProps {
  point: GamePoint;
  allPoints: GamePoint[];
  playgrounds?: Playground[]; // Added
  onSave: (point: GamePoint) => void;
  onClose: () => void;
  onStartDrawMode: (trigger: 'onOpen' | 'onCorrect' | 'onIncorrect') => void;
}

type TriggerType = 'onOpen' | 'onCorrect' | 'onIncorrect';

const TRIGGER_TABS: { id: TriggerType; label: string; icon: any; color: string }[] = [
    { id: 'onOpen', label: 'WHEN OPENED', icon: Zap, color: 'text-blue-500' },
    { id: 'onCorrect', label: 'IF CORRECT', icon: CheckCircle, color: 'text-green-500' },
    { id: 'onIncorrect', label: 'IF INCORRECT', icon: XCircle, color: 'text-red-500' },
];

const ACTION_TYPES: { id: ActionType; label: string; icon: any; description: string }[] = [
    { id: 'unlock', label: 'Unlock Task', icon: Unlock, description: 'Reveals a hidden or locked task on the map.' },
    { id: 'lock', label: 'Lock Task', icon: Lock, description: 'Disables a task so it cannot be accessed.' },
    { id: 'score', label: 'Give/Take Points', icon: Coins, description: 'Award bonus points or apply a penalty.' },
    { id: 'message', label: 'Show Message', icon: MessageSquare, description: 'Display a popup message to the player.' },
    { id: 'double_trouble', label: 'Double Trouble', icon: Skull, description: 'Next task has 2x points but high risk.' },
    { id: 'open_playground', label: 'Open Playground', icon: LayoutGrid, description: 'Enter a specific virtual sub-zone.' },
];

const TaskActionModal: React.FC<TaskActionModalProps> = ({ point, allPoints, playgrounds, onSave, onClose, onStartDrawMode }) => {
  const [activeTrigger, setActiveTrigger] = useState<TriggerType>('onCorrect');
  const [logic, setLogic] = useState<TaskLogic>(point.logic || {});

  const handleAddAction = (type: ActionType) => {
      const newAction: GameAction = {
          id: `act-${Date.now()}`,
          type,
          value: type === 'score' ? 100 : undefined
      };
      
      setLogic(prev => ({
          ...prev,
          [activeTrigger]: [...(prev[activeTrigger] || []), newAction]
      }));
  };

  const handleRemoveAction = (actionId: string) => {
      setLogic(prev => ({
          ...prev,
          [activeTrigger]: prev[activeTrigger]?.filter(a => a.id !== actionId)
      }));
  };

  const handleUpdateAction = (actionId: string, updates: Partial<GameAction>) => {
      setLogic(prev => ({
          ...prev,
          [activeTrigger]: prev[activeTrigger]?.map(a => a.id === actionId ? { ...a, ...updates } : a)
      }));
  };

  const handleSave = () => {
      // ENHANCED VALIDATION: Check all action types for required fields
      const allTriggers = ['onOpen', 'onCorrect', 'onIncorrect'];
      for (const trigger of allTriggers) {
          const actions = logic[trigger as TriggerType];
          if (actions) {
               // Check for missing targetId
               const missingTarget = actions.find(a =>
                   (['unlock', 'lock', 'reveal', 'open_playground'].includes(a.type) && !a.targetId)
               );
               if (missingTarget) {
                   const triggerLabel = TRIGGER_TABS.find(t => t.id === trigger)?.label || trigger;
                   const actionLabel = ACTION_TYPES.find(t => t.id === missingTarget.type)?.label || missingTarget.type;
                   alert(`Please select a target for the "${actionLabel}" action in "${triggerLabel}".`);
                   return;
               }

               // Check for missing or invalid score values
               const invalidScore = actions.find(a =>
                   a.type === 'score' && (a.value === undefined || !Number.isFinite(a.value))
               );
               if (invalidScore) {
                   const triggerLabel = TRIGGER_TABS.find(t => t.id === trigger)?.label || trigger;
                   alert(`Please enter a valid number for the score action in "${triggerLabel}".`);
                   return;
               }

               // Check for empty message text
               const emptyMessage = actions.find(a =>
                   a.type === 'message' && (!a.value || String(a.value).trim().length === 0)
               );
               if (emptyMessage) {
                   const triggerLabel = TRIGGER_TABS.find(t => t.id === trigger)?.label || trigger;
                   alert(`Please enter message text for the message action in "${triggerLabel}".`);
                   return;
               }
          }
      }

      onSave({ ...point, logic });
      onClose();
  };

  const renderActionEditor = (action: GameAction, index: number) => {
      return (
          <div key={action.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 mb-2 flex flex-col gap-2 animate-in slide-in-from-right-4 fade-in">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <span className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                          #{index + 1}
                      </span>
                      <span className="font-bold text-sm uppercase text-gray-800 dark:text-white flex items-center gap-1">
                          {ACTION_TYPES.find(t => t.id === action.type)?.label || action.type}
                      </span>
                  </div>
                  <button onClick={() => handleRemoveAction(action.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                  </button>
              </div>

              {/* Action specific inputs */}
              <div className="flex flex-col gap-2">
                  {(action.type === 'unlock' || action.type === 'lock' || action.type === 'reveal') && (
                      <select
                          className="w-full p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm focus:border-indigo-500 outline-none"
                          value={action.targetId || ''}
                          onChange={(e) => handleUpdateAction(action.id, { targetId: e.target.value })}
                      >
                          <option value="" disabled>Select Target Task...</option>
                          {allPoints
                              .map((p, idx) => ({ ...p, order: idx + 1 }))
                              .filter(p => p.id !== point.id && !p.isSectionHeader)
                              .map(p => (
                              <option key={p.id} value={p.id}>#{String(p.order).padStart(2, '0')} {p.title}</option>
                          ))}
                      </select>
                  )}

                  {action.type === 'open_playground' && (
                      <select 
                          className="w-full p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm focus:border-indigo-500 outline-none"
                          value={action.targetId || ''}
                          onChange={(e) => handleUpdateAction(action.id, { targetId: e.target.value })}
                      >
                          <option value="" disabled>Select Playground...</option>
                          {playgrounds?.map(pg => (
                              <option key={pg.id} value={pg.id}>{pg.title}</option>
                          ))}
                      </select>
                  )}

                  {action.type === 'score' && (
                      <div className="flex items-center gap-2">
                          <input 
                              type="number" 
                              className="w-24 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm focus:border-indigo-500 outline-none"
                              value={action.value || 0}
                              onChange={(e) => handleUpdateAction(action.id, { value: parseInt(e.target.value) })}
                              placeholder="Points"
                          />
                          <span className="text-xs text-gray-500 uppercase">Points (Use negative to subtract)</span>
                      </div>
                  )}

                  {action.type === 'message' && (
                      <textarea 
                          className="w-full p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm min-h-[60px] focus:border-indigo-500 outline-none"
                          value={action.value || ''}
                          onChange={(e) => handleUpdateAction(action.id, { value: e.target.value })}
                          placeholder="Enter message to display..."
                      />
                  )}

                  {action.type === 'double_trouble' && (
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-800 dark:text-red-200 font-bold uppercase">
                          ⚠️ Correct: 2x Points | Incorrect: -1x Points
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const activeActions = logic[activeTrigger] || [];

  return (
    <div className="fixed inset-0 z-[5100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <h2 className="text-lg font-bold uppercase tracking-wider">Configure Actions</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Trigger Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
            {TRIGGER_TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTrigger(tab.id)}
                    className={`flex-1 py-3 text-xs font-bold uppercase flex flex-col items-center gap-1 transition-colors border-b-2 ${activeTrigger === tab.id ? 'border-indigo-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                    <div className={`flex items-center gap-1 ${activeTrigger === tab.id ? tab.color : ''}`}>
                        <tab.icon className="w-3 h-3" />
                        {tab.label}
                    </div>
                </button>
            ))}
        </div>

        {/* Action List Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-900">
            {/* Draw Connections Button - Now Available for Correct AND Incorrect */}
            {(activeTrigger === 'onCorrect' || activeTrigger === 'onIncorrect') && (
                <button 
                    onClick={() => {
                        onSave({ ...point, logic });
                        onStartDrawMode(activeTrigger);
                    }}
                    className={`w-full mb-4 py-3 text-white rounded-xl font-bold uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg transition-all ${
                        activeTrigger === 'onCorrect' 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                    <PenTool className="w-4 h-4" /> 
                    {activeTrigger === 'onCorrect' ? 'DRAW "IF CORRECT" FLOW' : 'DRAW "IF INCORRECT" FLOW'}
                </button>
            )}

            {activeActions.length === 0 ? (
                <div className="text-center py-10 opacity-50 flex flex-col items-center">
                    <ArrowRight className="w-8 h-8 mb-2 text-gray-400" />
                    <p className="text-sm font-bold text-gray-500 uppercase">No actions defined for this event.</p>
                    <p className="text-xs text-gray-400">Add an action below to make something happen.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {activeActions.map((action, idx) => renderActionEditor(action, idx))}
                </div>
            )}
        </div>

        {/* Add Action Bar */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">ADD NEW ACTION</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
                {ACTION_TYPES.map(type => (
                    <div key={type.id} className="relative group">
                        <button
                            onClick={() => handleAddAction(type.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm"
                        >
                            <type.icon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">{type.label}</span>
                        </button>
                        
                        {/* Hover Explainer Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center font-medium border border-slate-700">
                            {type.description}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-r border-b border-slate-700"></div>
                        </div>
                    </div>
                ))}
            </div>
            
            <button 
                onClick={handleSave}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg"
            >
                <Save className="w-4 h-4" /> SAVE ACTIONS
            </button>
        </div>

      </div>
    </div>
  );
};

export default TaskActionModal;
