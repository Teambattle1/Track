import React from 'react';
import { X, Bell, CheckCircle, XCircle, Camera, Clock } from 'lucide-react';
import { ActivitySummary } from '../services/activityTracker';

interface ActivityNotificationModalProps {
  activity: ActivitySummary;
  onClose: () => void;
  onNavigateToGame?: (gameId: string) => void;
}

const ActivityNotificationModal: React.FC<ActivityNotificationModalProps> = ({
  activity,
  onClose,
  onNavigateToGame
}) => {
  const hasActivity = activity.newSubmissions > 0 || 
                      activity.recentlyApproved > 0 || 
                      activity.recentlyRejected > 0 ||
                      activity.pendingApprovals > 0;

  if (!hasActivity) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-orange-900/30 to-purple-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider">
                  What's New
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Activity since your last login
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            {activity.newSubmissions > 0 && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  <span className="text-xs font-bold text-blue-300 uppercase">New Submissions</span>
                </div>
                <div className="text-3xl font-black text-white">{activity.newSubmissions}</div>
              </div>
            )}

            {activity.pendingApprovals > 0 && (
              <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  <span className="text-xs font-bold text-orange-300 uppercase">Pending Approval</span>
                </div>
                <div className="text-3xl font-black text-white">{activity.pendingApprovals}</div>
              </div>
            )}

            {activity.recentlyApproved > 0 && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-xs font-bold text-green-300 uppercase">Approved</span>
                </div>
                <div className="text-3xl font-black text-white">{activity.recentlyApproved}</div>
              </div>
            )}

            {activity.recentlyRejected > 0 && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-xs font-bold text-red-300 uppercase">Rejected</span>
                </div>
                <div className="text-3xl font-black text-white">{activity.recentlyRejected}</div>
              </div>
            )}
          </div>

          {/* Per-Game Activity */}
          {activity.gameActivities.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase mb-3">Activity by Game</h3>
              <div className="space-y-2">
                {activity.gameActivities.map(game => (
                  <div
                    key={game.gameId}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:bg-slate-800 transition-all cursor-pointer"
                    onClick={() => onNavigateToGame?.(game.gameId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-white text-sm">{game.gameName}</h4>
                        <div className="flex gap-4 mt-2 text-xs">
                          {game.newSinceLogin > 0 && (
                            <div className="flex items-center gap-1 text-blue-400">
                              <Camera className="w-3 h-3" />
                              <span>{game.newSinceLogin} new</span>
                            </div>
                          )}
                          {game.pendingCount > 0 && (
                            <div className="flex items-center gap-1 text-orange-400">
                              <Clock className="w-3 h-3" />
                              <span>{game.pendingCount} pending</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 ml-4">
                        {game.pendingCount > 0 && (
                          <div className="bg-orange-600 text-white text-xs font-black px-3 py-1 rounded-full">
                            {game.pendingCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold uppercase text-sm transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityNotificationModal;
