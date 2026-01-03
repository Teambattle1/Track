import React, { useState } from 'react';
import { X, Smartphone, Monitor } from 'lucide-react';
import { GamePoint } from '../types';
import DOMPurify from 'dompurify';
import { replacePlaceholders } from '../utils/placeholders';

interface DevicePreviewModalProps {
  point: GamePoint;
  onClose: () => void;
}

const DevicePreviewModal: React.FC<DevicePreviewModalProps> = ({ point, onClose }) => {
  const [activeDevice, setActiveDevice] = useState<'mobile' | 'tablet'>('mobile');
  const [previewTeamName] = useState('Team Demo');

  // Replace placeholders with sample team name
  const previewQuestion = replacePlaceholders(point.task.question || '', previewTeamName);

  const getDeviceDimensions = (device: 'mobile' | 'tablet') => {
    if (device === 'mobile') {
      return { width: '375px', height: '812px', aspectRatio: '9/16' };
    } else {
      // Lenovo Tab 8 approximation - 8" tablet in landscape
      return { width: '1024px', height: '600px', aspectRatio: '16/9' };
    }
  };

  const dimensions = getDeviceDimensions(activeDevice);

  return (
    <div className="fixed inset-0 z-[9500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg"><Smartphone className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest">Task Preview</h2>
              <p className="text-xs opacity-90">View how your task appears on different devices</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Device Selector */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={() => setActiveDevice('mobile')}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm uppercase transition-all ${
              activeDevice === 'mobile'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Mobile (Portrait)
          </button>
          <button
            onClick={() => setActiveDevice('tablet')}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm uppercase transition-all ${
              activeDevice === 'tablet'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Tablet (Landscape)
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          {/* Device Frame */}
          <div
            className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden border-8 border-gray-800 dark:border-gray-700"
            style={{
              width: dimensions.width,
              height: dimensions.height,
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            {/* Device Notch/Status Bar */}
            {activeDevice === 'mobile' && (
              <div className="h-6 bg-gray-900 flex items-center justify-between px-4 text-white text-[8px] font-bold">
                <span>9:41</span>
                <div className="flex gap-1 text-[10px]">⚡📶</div>
              </div>
            )}

            {/* Task Modal Content */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 flex flex-col">
              {/* Header */}
              <div className="p-6 bg-orange-100 dark:bg-orange-900/30 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{point.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Task Preview</p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 flex-1">
                {/* Task Question */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-gray-800 dark:text-gray-100 text-base leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewQuestion) }} />
                </div>

                {/* Task Image if exists */}
                {point.task.imageUrl && (
                  <div className="mt-4">
                    <img src={point.task.imageUrl} alt="Task" className="w-full rounded-lg object-cover max-h-40" />
                  </div>
                )}

                {/* Sample Input Area - Varies by task type */}
                {point.task.type === 'text' && (
                  <div className="mt-6 space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Your Answer</label>
                    <input type="text" placeholder="Type your answer..." className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" disabled />
                  </div>
                )}

                {point.task.type === 'multiple_choice' && (
                  <div className="mt-6 space-y-2">
                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Select Answer</label>
                    {point.task.options?.slice(0, 3).map((opt, idx) => (
                      <button key={idx} className="w-full p-3 text-left border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-orange-500 transition-colors" disabled>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {point.task.type === 'boolean' && (
                  <div className="mt-6 flex gap-2">
                    <button className="flex-1 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-orange-500 transition-colors" disabled>YES</button>
                    <button className="flex-1 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-orange-500 transition-colors" disabled>NO</button>
                  </div>
                )}

                {(point.task.type === 'photo' || point.task.type === 'video') && (
                  <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                      {point.task.type === 'photo' ? '📸 Photo Upload' : '🎥 Video Upload'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button className="w-full py-3 bg-green-600 text-white rounded-xl font-bold uppercase text-sm hover:bg-green-700 transition-colors" disabled>Submit Answer</button>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder Info */}
        {point.task.question?.includes('${TEAM_NAME}') && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            <strong>ℹ️ Placeholder Preview:</strong> The <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">${'TEAM_NAME'}</code> placeholder is replaced with "<strong>{previewTeamName}</strong>" in this preview
          </div>
        )}
      </div>
    </div>
  );
};

export default DevicePreviewModal;
