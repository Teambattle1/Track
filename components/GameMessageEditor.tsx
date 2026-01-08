import React, { useState, useRef } from 'react';
import { Bold, Italic, Underline, Palette, Plus, X, Loader2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import DOMPurify from 'dompurify';
import { uploadImage } from '../services/storage';

export interface GameMessage {
  enabled: boolean;
  useImage: boolean; // If true, display image instead of text
  text: string; // HTML formatted text
  imageUrl?: string;
  textColor: string; // Hex color
  backgroundColor: string; // Hex color
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'; // Relative sizes
}

interface GameMessageEditorProps {
  message: GameMessage;
  onChange: (message: GameMessage) => void;
  label?: string;
  placeholder?: string;
}

const TEXT_SIZE_MAP = {
  small: 'text-base',
  medium: 'text-lg',
  large: 'text-2xl',
  xlarge: 'text-4xl'
};

const FONT_SIZE_PIXELS = {
  small: '16px',
  medium: '18px',
  large: '24px',
  xlarge: '32px'
};

const GameMessageEditor: React.FC<GameMessageEditorProps> = ({ 
  message, 
  onChange, 
  label = 'Message',
  placeholder = 'Enter message text...' 
}) => {
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (html: string) => {
    onChange({ ...message, text: html });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) {
        onChange({ ...message, imageUrl: url });
      }
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommand = (command: string, val?: string) => {
    document.execCommand(command, false, val || '');
  };

  return (
    <div className="space-y-3">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">Enabled</span>
          <div className={`w-10 h-6 rounded-full transition-all ${message.enabled ? 'bg-green-600' : 'bg-slate-700'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-all transform ${
              message.enabled ? 'translate-x-5' : 'translate-x-0.5'
            } translate-y-0.5`} />
          </div>
          <input 
            type="checkbox" 
            checked={message.enabled} 
            onChange={(e) => onChange({ ...message, enabled: e.target.checked })}
            className="hidden"
          />
        </label>
      </div>

      {!message.enabled ? (
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-500 text-center">
          Enable this message to use it in your game
        </div>
      ) : (
        <>
          {/* Image vs Text Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...message, useImage: false })}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${
                !message.useImage
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              TEXT MODE
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...message, useImage: true })}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors ${
                message.useImage
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              IMAGE MODE
            </button>
          </div>

          {!message.useImage ? (
            <>
              {/* Text Editor */}
              <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-900 border-b border-slate-700">
                  <button type="button" onClick={() => handleCommand('bold')} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Bold">
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => handleCommand('italic')} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Italic">
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => handleCommand('underline')} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Underline">
                    <Underline className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-6 bg-slate-700" />

                  {/* Text Color */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white flex items-center gap-1"
                      title="Text Color"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <div className="w-3 h-3 rounded border border-slate-600" style={{ backgroundColor: message.textColor }} />
                    </button>
                    {showColorPicker === 'text' && (
                      <div className="absolute top-full mt-1 left-0 bg-slate-900 border border-slate-700 rounded-lg p-3 z-10">
                        <input
                          type="color"
                          value={message.textColor}
                          onChange={(e) => {
                            onChange({ ...message, textColor: e.target.value });
                            setShowColorPicker(null);
                          }}
                          className="w-12 h-12 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Background Color */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(showColorPicker === 'bg' ? null : 'bg')}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white flex items-center gap-1"
                      title="Background Color"
                    >
                      <div className="w-4 h-4 rounded border border-slate-600" style={{ backgroundColor: message.backgroundColor }} />
                    </button>
                    {showColorPicker === 'bg' && (
                      <div className="absolute top-full mt-1 left-0 bg-slate-900 border border-slate-700 rounded-lg p-3 z-10">
                        <input
                          type="color"
                          value={message.backgroundColor}
                          onChange={(e) => {
                            onChange({ ...message, backgroundColor: e.target.value });
                            setShowColorPicker(null);
                          }}
                          className="w-12 h-12 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  <div className="w-px h-6 bg-slate-700" />

                  {/* Font Size */}
                  <select
                    value={message.fontSize}
                    onChange={(e) => onChange({ ...message, fontSize: e.target.value as any })}
                    className="px-2 py-1.5 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-600 transition-colors"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="xlarge">X-Large</option>
                  </select>
                </div>

                {/* Editor */}
                <div
                  className="p-4 outline-none text-sm flex-1 min-h-[150px] overflow-y-auto"
                  contentEditable
                  onInput={(e) => handleTextChange(e.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }}
                  data-placeholder={placeholder}
                  style={{ color: message.textColor }}
                />
              </div>

              {/* Preview */}
              {message.text && (
                <div className="p-4 rounded-lg border border-slate-700" style={{ backgroundColor: message.backgroundColor }}>
                  <div
                    className={`${TEXT_SIZE_MAP[message.fontSize]}`}
                    style={{ color: message.textColor }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }}
                  />
                </div>
              )}

              {/* Canva Link Button */}
              <a
                href="https://www.canva.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                DESIGN IN CANVA
              </a>
            </>
          ) : (
            <>
              {/* Image Editor */}
              {message.imageUrl ? (
                <div className="relative group">
                  <img
                    src={message.imageUrl}
                    alt="Message"
                    className="w-full h-48 object-cover rounded-lg border-2 border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...message, imageUrl: undefined })}
                    className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className="block w-full p-8 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-lg cursor-pointer transition-all text-center bg-slate-900">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {isUploading ? (
                    <>
                      <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
                      <p className="text-sm text-slate-400">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm text-slate-400">Click to upload image</p>
                      <p className="text-xs text-slate-600 mt-1">JPG, PNG or GIF</p>
                    </>
                  )}
                </label>
              )}

              {/* Canva Link Button */}
              <a
                href="https://www.canva.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                DESIGN IN CANVA
              </a>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GameMessageEditor;
