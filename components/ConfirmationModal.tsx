import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: 'warning' | 'question' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
  icon = 'question'
}) => {
  if (!isOpen) return null;

  const iconColorMap = {
    warning: 'text-red-500 bg-red-600/20 border-red-600',
    question: 'text-blue-500 bg-blue-600/20 border-blue-600',
    info: 'text-slate-500 bg-slate-600/20 border-slate-600'
  };

  const confirmButtonStyle = isDangerous
    ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/50'
    : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/50';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto animate-in fade-in">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-4 ${iconColorMap[icon]}`}>
          {icon === 'warning' && <AlertTriangle className="w-6 h-6" />}
          {icon === 'question' && <AlertTriangle className="w-6 h-6" />}
          {icon === 'info' && <AlertTriangle className="w-6 h-6" />}
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-3">
          {title}
        </h2>

        {/* Message */}
        <p className="text-sm text-slate-300 mb-6 leading-relaxed whitespace-pre-wrap">
          {message}
        </p>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg uppercase tracking-widest text-xs transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`py-3 text-white font-bold rounded-lg uppercase tracking-widest text-xs transition-colors ${confirmButtonStyle}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
