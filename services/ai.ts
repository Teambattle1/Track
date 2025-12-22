
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { TaskTemplate, IconId, TaskType } from "../types";

// Schema to ensure Gemini returns data compatible with our App
const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Short catchy title for the task" },
      question: { type: Type.STRING, description: "The actual question or challenge text" },
      type: { 
        type: Type.STRING, 
        enum: ["text", "multiple_choice", "boolean", "slider", "checkbox", "dropdown"],
        description: "The type of input required"
      },
      answer: { type: Type.STRING, description: "The correct answer (for text/boolean/dropdown)", nullable: true },
      options: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Options for multiple_choice, checkbox, dropdown",
        nullable: true
      },
      correctAnswers: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Array of correct answers if type is checkbox",
        nullable: true
      },
      numericRange: {
        type: Type.OBJECT,
        properties: {
          min: { type: Type.NUMBER },
          max: { type: Type.NUMBER },
          correctValue: { type: Type.NUMBER }
        },
        description: "Only for slider type",
        nullable: true
      },
      iconId: { 
        type: Type.STRING, 
        enum: ['default', 'star', 'flag', 'trophy', 'camera', 'question', 'skull', 'treasure'],
        description: "The visual icon for the map"
      },
      hint: { type: Type.STRING, description: "A helpful hint for the player", nullable: true }
    },
    required: ["title", "question", "type", "iconId"]
  }
};

// Schema for single task generation from image
const singleTaskSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short catchy title for the task" },
    question: { type: Type.STRING, description: "The actual question or challenge text based on the image" },
    type: { 
      type: Type.STRING, 
      enum: ["text", "multiple_choice", "boolean", "slider", "checkbox", "dropdown"],
      description: "The type of input required"
    },
    answer: { type: Type.STRING, description: "The correct answer (for text/boolean/dropdown)", nullable: true },
    options: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Options for multiple_choice, checkbox, dropdown",
      nullable: true
    },
    correctAnswers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of correct answers if type is checkbox",
      nullable: true
    },
    numericRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER },
        correctValue: { type: Type.NUMBER }
      },
      description: "Only for slider type",
      nullable: true
    },
    iconId: { 
      type: Type.STRING, 
      enum: ['default', 'star', 'flag', 'trophy', 'camera', 'question', 'skull', 'treasure'],
      description: "The visual icon for the map"
    },
    hint: { type: Type.STRING, description: "A helpful hint for the player", nullable: true },
    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tags describing the content" }
  },
  required: ["title", "question", "type", "iconId"]
};

// Helper for Exponential Backoff Retry
async function makeRequestWithRetry<T>(requestFn: () => Promise<T>, maxRetries = 3, delay = 2000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error: any) {
      const msg = error.message || String(error);
      const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');
      
      if (isRateLimit && i < maxRetries - 1) {
        console.warn(`AI Rate limit hit. Retrying in ${delay / 1000} seconds... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} retries due to rate limiting.`);
}

const handleAiError = (error: any) => {
    const msg = error.message || String(error);
    
    // Check specifically for quota errors to suppress loud console errors if they bubble up past retry
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
        console.warn("AI Quota/Rate Limit hit (logging suppressed).");
        // Throw a user-friendly error that the UI can catch and display gracefully
        throw new Error("AI Service is currently busy (Quota Exceeded). Please wait a moment and try again.");
    }

    console.error("AI Error:", error);
    throw error;
};

export const generateAiTasks = async (topic: string, count: number = 5, language: string = 'English', additionalTag?: string): Promise<TaskTemplate[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error("Request timed out. The AI model is taking too long to respond."));
    }, 90000);
  });

  try {
    const apiCallPromise = makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create exactly ${count} diverse and fun scavenger hunt/quiz tasks for a location-based game.
      Topic: "${topic}"
      Language: ${language}
      
      Ensure a mix of task types (multiple_choice, text, boolean, slider, checkbox).
      For 'slider', provide min, max, and correctValue.
      For 'checkbox', provide multiple correct options in correctAnswers.
      The 'iconId' should be relevant to the specific question's content.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: "You are a professional game designer for 'TeamAction', a location-based GPS adventure. You specialize in creating concise, engaging, and localized tasks.",
      },
    }));

    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    const rawData = JSON.parse(response.text || "[]");

    return rawData.map((item: any, index: number) => {
      // Logic for tags: "AI", Country (Language), and optional Auto-Tag
      const countryTag = language.split(' ')[0]; // Extracts "Danish" from "Danish (Dansk)"
      const tags = ['AI', countryTag];
      if (additionalTag && additionalTag.trim()) {
          tags.push(additionalTag.trim());
      }

      return {
        id: `ai-${Date.now()}-${index}`,
        title: item.title,
        iconId: (item.iconId as IconId) || 'default',
        tags: tags,
        createdAt: Date.now(),
        points: 100,
        task: {
          type: (item.type as TaskType) || 'text',
          question: item.question,
          answer: item.answer,
          options: item.options,
          correctAnswers: item.correctAnswers,
          range: item.numericRange ? {
            min: item.numericRange.min,
            max: item.numericRange.max,
            step: 1,
            correctValue: item.numericRange.correctValue,
            tolerance: 0
          } : undefined
        },
        feedback: {
          correctMessage: 'Correct!',
          showCorrectMessage: true,
          incorrectMessage: 'Not quite. Try again!',
          showIncorrectMessage: true,
          hint: item.hint || 'Look closely!',
          hintCost: 10
        },
        settings: {
          scoreDependsOnSpeed: false,
          language: language,
          showAnswerStatus: true,
          showCorrectAnswerOnMiss: false
        }
      };
    });
  } catch (error) {
    handleAiError(error);
    return []; // Should throw, but Typescript needs return
  }
};

export const generateTaskFromImage = async (base64Image: string): Promise<TaskTemplate | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return null;
    
    const mimeType = matches[1];
    const data = matches[2];

    const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: data
            }
          },
          {
            text: "Create an engaging scavenger hunt task based on this image. Return JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: singleTaskSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }));

    const item = JSON.parse(response.text || "{}");
    if (!item.title) return null;

    return {
        id: `ai-img-${Date.now()}`,
        title: item.title,
        iconId: (item.iconId as IconId) || 'camera',
        tags: ['AI', 'Image'],
        createdAt: Date.now(),
        points: 100,
        task: {
          type: (item.type as TaskType) || 'text',
          question: item.question,
          answer: item.answer,
          options: item.options,
          correctAnswers: item.correctAnswers,
          imageUrl: base64Image,
          range: item.numericRange ? {
            min: item.numericRange.min,
            max: item.numericRange.max,
            step: 1,
            correctValue: item.numericRange.correctValue,
            tolerance: 0
          } : undefined
        },
        feedback: {
          correctMessage: 'Correct!',
          showCorrectMessage: true,
          incorrectMessage: 'Incorrect, try again.',
          showIncorrectMessage: true,
          hint: item.hint || 'Check the details!',
          hintCost: 10
        },
        settings: {
          scoreDependsOnSpeed: false,
          language: 'English',
          showAnswerStatus: true,
          showCorrectAnswerOnMiss: false
        }
    };
  } catch (error) {
    handleAiError(error);
    return null;
  }
};

export const generateAiImage = async (prompt: string, style: string = 'cartoon'): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: `A simple, flat, vector illustration for a game task: ${prompt}. Style: ${style}. Minimal background, high contrast.`,
        }));
        
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (e) {
        handleAiError(e);
        return null;
    }
};

export const findCompanyDomain = async (query: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Return ONLY the official website domain for: "${query}" (e.g. google.com). If not a company or not found, return "null".`,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        }));
        const text = response.text?.trim() || "";
        return text !== "null" && text.includes('.') ? text : null;
    } catch (e) {
        return null;
    }
};

export const searchLogoUrl = async (query: string): Promise<string | null> => {
    try {
        const domain = await findCompanyDomain(query);
        if (!domain) return null;

        const checkImage = (url: string): Promise<boolean> => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = url;
            });
        };

        const clearbitUrl = `https://logo.clearbit.com/${domain}`;
        if (await checkImage(clearbitUrl)) return clearbitUrl;

        const googleUrl = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=256`;
        if (await checkImage(googleUrl)) return googleUrl;

        return null;
    } catch (e) {
        return null;
    }
};
