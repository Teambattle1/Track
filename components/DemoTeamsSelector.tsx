import React from 'react';
import { X, Users, Zap } from 'lucide-react';
import { Team } from '../types';

interface DemoTeamsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  demoTeams: Team[];
  onSelectTeam: (teamId: string) => void;
}

const DemoTeamsSelector: React.FC<DemoTeamsSelectorProps> = ({
  isOpen,
  onClose,
  demoTeams,
  onSelectTeam
}) => {
  if (!isOpen || demoTeams.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-orange-100 dark:bg-orange-900/30 border-b border-orange-200 dark:border-orange-800">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Demo Team Preview</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  No real teams yet. Select a demo team to preview the lobby
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* Demo Badge Info */}
          <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-3">
            <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-orange-700 dark:text-orange-300">
              <strong>Demo Mode:</strong> These are example teams for previewing the lobby interface. They will disappear when real teams join the game.
            </p>
          </div>

          {/* Demo Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demoTeams.map(team => (
              <button
                key={team.id}
                onClick={() => {
                  onSelectTeam(team.id);
                  onClose();
                }}
                className="text-left p-5 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-lg transition-all group relative"
              >
                {/* Demo Badge */}
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold uppercase">
                    <Zap className="w-3 h-3" />
                    Demo
                  </span>
                </div>

                <div className="pr-20">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {team.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
                    Team ID: {team.id.substring(0, 8)}...
                  </p>
                  
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                    <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Users className="w-4 h-4" />
                      {team.members?.length || 0} members
                    </span>
                    <span className="flex items-center gap-1 text-sm font-bold text-orange-600 dark:text-orange-400">
                      {team.score || 0} pts
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoTeamsSelector;
