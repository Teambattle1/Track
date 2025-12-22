
import { TaskTemplate, TaskType, IconId } from '../types';

// Using a transparent CORS proxy to bypass browser restrictions
const CORS_PROXY = 'https://corsproxy.io/?';
// Upgrading to V4 as per official documentation
const BASE_URL = 'https://api.loquiz.com/v4';

export interface LoquizGame {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
}

export interface LoquizTask {
  id: string;
  title?: string;
  content: string; 
  type: 'single' | 'multiple' | 'text' | 'numeric' | 'photo' | 'video' | 'info';
  points: number;
  options?: { text: string; isCorrect: boolean; points?: number }[]; 
  media?: { url: string; type: string }[];
}

const mapLoquizType = (type: string): TaskType => {
  switch (type) {
    case 'single': return 'multiple_choice';
    case 'multiple': return 'checkbox';
    case 'numeric': return 'slider';
    case 'text': return 'text';
    default: return 'text';
  }
};

const mapLoquizIcon = (type: string): IconId => {
  switch (type) {
    case 'single': return 'question';
    case 'multiple': return 'star';
    case 'numeric': return 'trophy';
    case 'photo': return 'camera';
    case 'video': return 'camera';
    case 'info': return 'flag';
    default: return 'default';
  }
};

const transformTask = (lt: LoquizTask): TaskTemplate => {
  const ourType = mapLoquizType(lt.type);
  const options = lt.options?.map(o => o.text) || [];
  const answer = lt.options?.find(o => o.isCorrect)?.text;
  const correctAnswers = lt.options?.filter(o => o.isCorrect).map(o => o.text);
  const imageUrl = lt.media?.find(m => m.type === 'image' || m.type === 'photo')?.url;

  const cleanTitle = lt.title || (lt.content 
      ? lt.content.replace(/<[^>]*>?/gm, '').substring(0, 40) + '...' 
      : 'Untitled Task');

  return {
    id: `loquiz-${lt.id}`,
    title: cleanTitle,
    iconId: mapLoquizIcon(lt.type),
    tags: ['LOQUIZ', lt.type.toUpperCase()],
    createdAt: Date.now(),
    points: lt.points || 100,
    task: {
      question: lt.content || '', 
      type: ourType,
      options: options.length > 0 ? options : undefined,
      answer: answer,
      correctAnswers: correctAnswers,
      imageUrl: imageUrl
    },
    settings: {
      language: 'English',
      showAnswerStatus: true,
      scoreDependsOnSpeed: false,
      showCorrectAnswerOnMiss: true
    },
    feedback: {
      correctMessage: "Correct!",
      showCorrectMessage: true,
      incorrectMessage: "Incorrect",
      showIncorrectMessage: true,
      hint: "",
      hintCost: 0
    }
  };
};

export const loquizApi = {
  fetchGames: async (apiKey: string): Promise<LoquizGame[]> => {
    const cleanKey = apiKey.trim();
    // V4: GET /games returns account games
    const url = `${BASE_URL}/games?limit=100`;
    
    console.log(`[Loquiz V4] Requesting Games list`);

    try {
      const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: { 
          'X-Api-Key': cleanKey,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
          const text = await response.text();
          console.error(`[Loquiz V4] API Error ${response.status}:`, text);
          throw new Error(`Loquiz V4 Error: ${response.status}. Please verify your X-API-KEY.`);
      }
      
      const data = await response.json();
      // V4 standard wrap results in 'items'
      return Array.isArray(data.items) ? data.items : [];
    } catch (error: any) {
      console.error("[Loquiz V4] fetchGames exception:", error);
      throw error;
    }
  },

  fetchAllTasks: async (apiKey: string): Promise<TaskTemplate[]> => {
    const cleanKey = apiKey.trim();
    // V4: GET /tasks fetches tasks from the account library directly
    const url = `${BASE_URL}/tasks?limit=250&includeMedia=true`;
    
    console.log(`[Loquiz V4] Requesting All Library Tasks`);

    try {
      const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: { 
          'X-Api-Key': cleanKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
          throw new Error(`Loquiz V4 Library Error: ${response.status}`);
      }
      
      const data = await response.json();
      const items: LoquizTask[] = Array.isArray(data.items) ? data.items : [];
      return items.map(transformTask);
    } catch (error: any) {
      console.error("[Loquiz V4] fetchAllTasks exception:", error);
      throw error;
    }
  },

  fetchTasksFromGame: async (apiKey: string, gameId: string): Promise<TaskTemplate[]> => {
    const cleanKey = apiKey.trim();
    // V4: GET /tasks?gameId={id} retrieves tasks assigned to a game
    const url = `${BASE_URL}/tasks?gameId=${gameId}&includeMedia=true`;
    
    console.log(`[Loquiz V4] Requesting Tasks for game: ${gameId}`);

    try {
      const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: { 
          'X-Api-Key': cleanKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
          throw new Error(`Loquiz V4 Tasks Error: ${response.status}`);
      }
      
      const data = await response.json();
      const items: LoquizTask[] = Array.isArray(data.items) ? data.items : [];
      return items.map(transformTask);
    } catch (error: any) {
      console.error("[Loquiz V4] fetchTasksFromGame exception:", error);
      throw error;
    }
  }
};
