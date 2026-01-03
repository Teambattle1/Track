import React, { useState } from 'react';
import { X, Check, XCircle, SlidersHorizontal, Camera, Video, Send } from 'lucide-react';
import { MediaSubmission } from '../types';

interface MediaApprovalModalProps {
  submission: MediaSubmission;
  onApprove: (submissionId: string, partialScore?: number) => void;
  onReject: (submissionId: string, message: string) => void;
  onClose: () => void;
  partialScoreEnabled?: boolean;
}

const MediaApprovalModal: React.FC<MediaApprovalModalProps> = ({
  submission,
  onApprove,
  onReject,
  onClose,
  partialScoreEnabled = false
}) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectMessage, setRejectMessage] = useState('');
  const [partialScore, setPartialScore] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      if (partialScoreEnabled && partialScore < 100) {
        await onApprove(submission.id, partialScore);
      } else {
        await onApprove(submission.id);
      }
      onClose();
    } catch (error) {
      console.error('Failed to approve:', error);
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectMessage.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setIsProcessing(true);
    try {
      await onReject(submission.id, rejectMessage);
      onClose();
    } catch (error) {
      console.error('Failed to reject:', error);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-purple-900/30 to-blue-900/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {submission.mediaType === 'photo' ? (
                <Camera className="w-6 h-6 text-purple-400" />
              ) : (
                <Video className="w-6 h-6 text-blue-400" />
              )}
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider">
                  {submission.mediaType === 'photo' ? 'Photo' : 'Video'} Approval
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {submission.pointTitle} • Team: {submission.teamName}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Media Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="bg-black rounded-xl overflow-hidden border border-slate-700">
            {submission.mediaType === 'photo' ? (
              <img
                src={submission.mediaUrl}
                alt="Submission"
                className="w-full h-auto max-h-[50vh] object-contain"
              />
            ) : (
              <video
                src={submission.mediaUrl}
                controls
                className="w-full h-auto max-h-[50vh]"
              />
            )}
          </div>

          {/* Submission Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-xs text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 uppercase font-bold">Task:</span>
                <div className="text-white font-bold mt-1">{submission.pointTitle}</div>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-bold">Team:</span>
                <div className="text-white font-bold mt-1">{submission.teamName}</div>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-bold">Submitted:</span>
                <div className="text-white font-bold mt-1">
                  {new Date(submission.submittedAt).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-bold">Type:</span>
                <div className="text-white font-bold mt-1 uppercase">{submission.mediaType}</div>
              </div>
            </div>
          </div>

          {/* Partial Score Slider (if enabled) */}
          {partialScoreEnabled && !isRejecting && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-black text-blue-300 uppercase flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  Partial Score
                </label>
                <span className="text-2xl font-black text-white">{partialScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={partialScore}
                onChange={(e) => setPartialScore(parseInt(e.target.value))}
                className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${partialScore}%, #475569 ${partialScore}%, #475569 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              <p className="text-xs text-blue-300 mt-3">
                Award partial credit based on the quality of the submission. 100% = full points.
              </p>
            </div>
          )}

          {/* Rejection Message */}
          {isRejecting && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
              <label className="block text-sm font-black text-red-300 uppercase mb-2">
                Rejection Message (sent to team)
              </label>
              <textarea
                value={rejectMessage}
                onChange={(e) => setRejectMessage(e.target.value)}
                placeholder="e.g., Your photo is blurry. Please take a clearer photo and try again."
                rows={4}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 outline-none focus:border-red-500 transition-all resize-none"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-700 bg-slate-900/50 shrink-0">
          {isRejecting ? (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsRejecting(false);
                  setRejectMessage('');
                }}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold uppercase text-sm transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectMessage.trim() || isProcessing}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold uppercase text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4" />
                {isProcessing ? 'Sending...' : 'Send & Reject'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setIsRejecting(true)}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-sm flex items-center justify-center gap-2 transition-colors"
                disabled={isProcessing}
              >
                <XCircle className="w-5 h-5" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-xl font-bold uppercase text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                {isProcessing ? 'Processing...' : partialScoreEnabled && partialScore < 100 ? `Approve (${partialScore}%)` : 'Approve (100%)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaApprovalModal;
