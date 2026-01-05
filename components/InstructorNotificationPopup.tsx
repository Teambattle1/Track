import React, { useEffect, useState } from 'react';
import { InstructorNotification } from '../types';
import { Bell, X, CheckCircle, XCircle, Zap } from 'lucide-react';

interface InstructorNotificationPopupProps {
  notifications: InstructorNotification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

const InstructorNotificationPopup: React.FC<InstructorNotificationPopupProps> = ({
  notifications,
  onDismiss,
  onDismissAll
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-show when new notifications arrive
  useEffect(() => {
    if (notifications.length > 0) {
      setIsExpanded(true);
    }
  }, [notifications.length]);

  if (notifications.length === 0) return null;

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'onOpen':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'onCorrect':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'onIncorrect':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'onOpen':
        return 'opened';
      case 'onCorrect':
        return 'completed correctly';
      case 'onIncorrect':
        return 'answered incorrectly';
      default:
        return 'triggered';
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  return (
    <div className="fixed top-20 right-4 z-[5000] w-96 max-w-[calc(100vw-2rem)] animate-in slide-in-from-right-4 fade-in duration-300">
      {/* Header */}
      <div className="bg-indigo-600 text-white rounded-t-xl p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 animate-pulse" />
          <h3 className="font-bold uppercase text-sm tracking-wider">
            Instructor Notifications ({notifications.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDismissAll}
            className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
            title="Dismiss All"
          >
            Clear All
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <X className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-900 border-x border-b border-gray-200 dark:border-gray-700 rounded-b-xl max-h-96 overflow-y-auto shadow-lg">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-in slide-in-from-top-2 fade-in"
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {getTriggerIcon(notification.trigger)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {notification.teamName}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {getTriggerLabel(notification.trigger)} task:
                  </p>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                    {notification.taskTitle}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {formatTime(notification.timestamp)}
                  </p>
                </div>
                <button
                  onClick={() => onDismiss(notification.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorNotificationPopup;
