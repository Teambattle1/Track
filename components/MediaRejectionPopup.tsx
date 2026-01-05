import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface MediaRejectionPopupProps {
  taskTitle: string;
  reviewerName: string;
  message: string;
  allowMultipleSubmissions: boolean;
  onClose: () => void;
}

const MediaRejectionPopup: React.FC<MediaRejectionPopupProps> = ({
  taskTitle,
  reviewerName,
  message,
  allowMultipleSubmissions,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-4 border-red-500 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 bg-red-700/50">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-white uppercase tracking-wide">
                SUBMISSION REJECTED
              </h2>
              <p className="text-red-100 text-sm mt-1">
                Task: <strong>{taskTitle}</strong>
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-red-600/50 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-4">
            <p className="text-xs font-bold text-red-300 uppercase mb-2">
              Reviewed by: {reviewerName || 'Instructor'}
            </p>
            {message && (
              <div className="bg-red-900/30 rounded-lg p-3 mt-2">
                <p className="text-sm text-red-100 leading-relaxed">
                  {message}
                </p>
              </div>
            )}
          </div>

          {allowMultipleSubmissions && (
            <div className="bg-orange-900/30 border border-orange-500/30 rounded-xl p-4">
              <p className="text-sm font-bold text-orange-200">
                ✓ This task is now open again for a new attempt
              </p>
              <p className="text-xs text-orange-300 mt-1">
                You can find it back on the map and submit again.
              </p>
            </div>
          )}

          {!allowMultipleSubmissions && (
            <div className="bg-gray-900/30 border border-gray-500/30 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-200">
                ⚠️ Multiple submissions are not allowed for this task
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Please contact the instructor if you think this is an error.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-red-950/30 border-t border-red-500/30">
          <button
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 px-6 rounded-xl transition-colors shadow-lg uppercase tracking-wider"
          >
            OK, GOT IT
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaRejectionPopup;
