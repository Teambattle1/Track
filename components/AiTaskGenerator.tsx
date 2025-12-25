
import React, { useState, useRef, useEffect } from 'react';
import { Wand2, X, Plus, Check, RefreshCw, ThumbsUp, ThumbsDown, Loader2, Sparkles, AlertCircle, Ban, Edit2, Globe, Tag, Image as ImageIcon, Home, Search, Hash, Save, Library, Gamepad2, Map, LayoutGrid, ArrowRight, LayoutList } from 'lucide-react';
import { TaskTemplate, Playground, TaskList } from '../types';
import { generateAiTasks, generateAiImage, searchLogoUrl } from '../services/ai';
import { ICON_COMPONENTS } from '../utils/icons';

interface AiTaskGeneratorProps {
  onClose: () => void;
  onAddTasks: (tasks: TaskTemplate[], targetPlaygroundId?: string | null) => void;
  onAddToLibrary?: (tasks: TaskTemplate[]) => void;
  onAddTasksToList?: (listId: string, tasks: TaskTemplate[]) => void;
  onCreateListWithTasks?: (name: string, tasks: TaskTemplate[]) => void;
  playgrounds?: Playground[];
  taskLists?: TaskList[];
  initialPlaygroundId?: string | null;
  targetMode?: 'GAME' | 'LIBRARY' | 'LIST'; // New prop to control context
}

const LANGUAGES = [
  '🇬🇧 English',
  '🇩🇰 Danish (Dansk)',
  '🇩🇪 German (Deutsch)',
  '🇪🇸 Spanish (Español)',
  '🇫🇷 French (Français)',
  '🇸🇪 Swedish (Svenska)',
  '🇳🇴 Norwegian (Norsk)',
  '🇳🇱 Dutch (Nederlands)',
  '🇧🇪 Belgian (Vlaams)',
  '🇮🇱 Hebrew (Ivrit)'
];

const AiTaskGenerator: React.FC<AiTaskGeneratorProps> = ({ onClose, onAddTasks, onAddToLibrary, onAddTasksToList, onCreateListWithTasks, playgrounds = [], taskLists = [], initialPlaygroundId = null, targetMode = 'GAME' }) => {
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('🇩🇰 Danish (Dansk)');
  const [taskCount, setTaskCount] = useState(5);
  const [autoTag, setAutoTag] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedBuffer, setGeneratedBuffer] = useState<TaskTemplate[]>([]);
  const [approvedTasks, setApprovedTasks] = useState<TaskTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [useLogoForTasks, setUseLogoForTasks] = useState(false);

  const [batchFinished, setBatchFinished] = useState(false);
  
  // Destination State
  const [destinationType, setDestinationType] = useState<'MAP' | 'PLAYGROUND'>(initialPlaygroundId ? 'PLAYGROUND' : 'MAP');
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<string | null>(initialPlaygroundId || (playgrounds.length > 0 ? playgrounds[0].id : null));
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  // If mode is LIST or LIBRARY, default behavior adjustments
  useEffect(() => {
      if (targetMode === 'LIST' || targetMode === 'LIBRARY') {
          setSaveToLibrary(true); // Always true for these modes essentially
      }
  }, [targetMode]);

  const isActiveRef = useRef(false);
  const topicInputRef = useRef<HTMLTextAreaElement>(null);

  const handleSearchLogo = async () => {
      if (!topic.trim()) return;
      setIsGeneratingLogo(true);
      setLogoUrl(null);
      setError(null);
      
      try {
          const url = await searchLogoUrl(topic);
          if (url) {
              setLogoUrl(url);
              setUseLogoForTasks(true);
          } else {
              setError("Could not find a logo for this topic.");
          }
      } catch (e) {
          setError("Error searching for logo.");
      } finally {
          setIsGeneratingLogo(false);
      }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (!autoTag.trim()) {
        setError("Tag is required for filtering.");
        return;
    }
    
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setBatchFinished(false);
    isActiveRef.current = true;
    
    const interval = setInterval(() => {
        setProgress(prev => {
            const increment = prev < 40 ? 5 : (prev < 70 ? 2 : (prev < 90 ? 1 : 0.5));
            const next = prev + increment;
            return next >= 98 ? 98 : next;
        });
    }, 400);
    
    try {
      const newTasks = await generateAiTasks(topic, taskCount, language, autoTag);
      
      if (!isActiveRef.current) {
          clearInterval(interval);
          return;
      }

      let imageUrlToUse = logoUrl && useLogoForTasks ? logoUrl : null;

      if (!imageUrlToUse) {
          const thematicImage = await generateAiImage(topic, 'scavenger');
          if (thematicImage) {
              imageUrlToUse = thematicImage;
          }
      }

      if (imageUrlToUse && isActiveRef.current) {
          newTasks.forEach(t => {
              t.task.imageUrl = imageUrlToUse!;
          });
      }

      clearInterval(interval);
      setProgress(100);
      
      setTimeout(() => {
          if (isActiveRef.current) {
              setGeneratedBuffer(newTasks);
              setIsGenerating(false);
              setProgress(0);
          