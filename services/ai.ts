import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { TaskTemplate, IconId, TaskType } from "../types";
import { normalizeLanguage } from "../utils/i18n";

// Security Fix: Do not rely solely on process.env in built client code.
// Allow override via LocalStorage for instructor/admin usage.
const getApiKey = (): string => {
    const localKey = typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
    if (localKey) return localKey;
    
    // Fallback to build-time env if available.
    // Vite defines these at build time (see vite.config.ts).
    // In the built bundle, this becomes a plain string literal (no runtime `process` required).
    const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    return envKey || '';
};

// Check if key exists before making calls
const ensureApiKey = () => {
    const key = getApiKey();
    if (!key) {
        throw new Error("AI API Key missing. Please set GEMINI_API_KEY in Local Storage or Settings.");
    }
    return key;
};

// ... Schema definitions ...
const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      question: { type: Type.STRING },
      type: { type: Type.STRING, enum: ["text", "multiple_choice", "boolean", "slider", "checkbox", "dropdown"] },
      answer: { type: Type.STRING, nullable: true },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
      correctAnswers: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
      numericRange: { type: Type.OBJECT, properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER }, correctValue: { type: Type.NUMBER } }, nullable: true },
      iconId: { type: Type.STRING, enum: ['default', 'star', 'flag', 'trophy', 'camera', 'question', 'skull', 'treasure'] },
      hint: { type: Type.STRING, nullable: true }
    },
    required: ["title", "question", "type", "iconId"]
  }
};

async function makeRequestWithRetry<T>(requestFn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error: any) {
      if ((error.message || '').includes('429') && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }
  }
  throw new Error("AI Request Failed");
}

export const generateAiTasks = async (topic: string, count: number = 5, language: string = 'English', additionalTag?: string): Promise<TaskTemplate[]> => {
  const key = ensureApiKey();
  const ai = new GoogleGenAI({ apiKey: key });
  
  try {
    const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create exactly ${count} diverse scavenger hunt tasks. Topic: "${topic}". Language: ${language}. Return JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 0 }
      },
    }));

    let rawData: any = [];
    try {
      rawData = JSON.parse(response.text || "[]");
    } catch {
      rawData = [];
    }

    if (!Array.isArray(rawData)) rawData = [];

    return rawData.map((item: any, index: number) => ({
        id: `ai-${Date.now()}-${index}`,
        title: item.title,
        iconId: (item.iconId as IconId) || 'default',
        tags: ['AI', language.split(' ')[0], ...(additionalTag ? [additionalTag] : [])],
        createdAt: Date.now(),
        points: 100,
        task: {
          type: (item.type as TaskType) || 'text',
          question: item.question,
          answer: item.answer,
          options: item.options,
          correctAnswers: item.correctAnswers,
          range: item.numericRange ? { ...item.numericRange, step: 1, tolerance: 0 } : undefined
        },
        feedback: {
          correctMessage: 'Correct!', showCorrectMessage: true,
          incorrectMessage: 'Try again!', showIncorrectMessage: true,
          hint: item.hint || '', hintCost: 10
        },
        settings: {
          scoreDependsOnSpeed: false, language: language, showAnswerStatus: true, showCorrectAnswerOnMiss: false
        }
    }));
  } catch (error) {
    console.error("AI Generation Error", error);
    throw error;
  }
};

export const generateAiImage = async (prompt: string, style: string = 'cartoon'): Promise<string | null> => {
    const key = ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: `Simple vector illustration: ${prompt}. Style: ${style}. Minimal background.`,
        }));
        if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
            return `data:${response.candidates[0].content.parts[0].inlineData.mimeType};base64,${response.candidates[0].content.parts[0].inlineData.data}`;
        }
        return null;
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const generateAvatar = async (keywords: string): Promise<string | null> => {
    return generateAiImage(`Avatar of ${keywords}`, 'vector art, colorful, circular crop style');
};

// Helper to verify if an image URL is valid and loadable
const verifyImage = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
};

export const searchLogoUrl = async (query: string): Promise<string | null> => {
    let domain = '';
    const key = getApiKey(); // Don't throw yet, try graceful fallback first

    // 1. Try AI-powered domain search if key exists
    if (key) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `What is the official website domain for "${query}"? Return ONLY the domain (e.g. "example.com"). Do not include https:// or www.`,
                config: {
                    tools: [{ googleSearch: {} }],
                }
            }));

            const text = response.text || '';
            const domainMatch = text.match(/([a-z0-9][a-z0-9-]{0,61}[a-z0-9]\.)+[a-z]{2,}/i);
            if (domainMatch) {
                domain = domainMatch[0];
            }
        } catch (e) {
            console.warn("AI Domain search failed, falling back to naive guess", e);
        }
    }

    // 2. Fallback to naive guess if AI failed or no key
    if (!domain) {
        domain = `${query.replace(/\s/g, '').toLowerCase()}.com`;
    }

    // 3. Try Clearbit
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    if (await verifyImage(clearbitUrl)) {
        return clearbitUrl;
    }

    // 4. Fallback to Google Favicon (Best effort)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
};

// Generate a mood-based audio vignette using Web Audio API
export const generateMoodAudio = async (topic: string): Promise<string | null> => {
    try {
        // Use Gemini to get a brief description of the mood/style
        const key = getApiKey();
        if (!key) throw new Error("API key missing");

        const ai = new GoogleGenAI({ apiKey: key });
        const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Describe the musical/audio mood for "${topic}" in ONE line. Be specific: instrument (e.g., piano), tempo (e.g., slow/fast), emotional tone (e.g., triumphant, calm, mysterious). Example: "Slow classical piano, calm and peaceful" or "Fast violins, energetic and exciting".`,
        }));

        const moodDescription = response.text || '';

        // Create audio using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const duration = 2.5; // 2.5 seconds
        const sampleRate = audioContext.sampleRate;
        const samples = duration * sampleRate;

        const audioBuffer = audioContext.createBuffer(1, samples, sampleRate);
        const data = audioBuffer.getChannelData(0);

        // Generate simple procedural audio based on mood keywords
        const isCalm = moodDescription.toLowerCase().includes('calm') ||
                      moodDescription.toLowerCase().includes('slow') ||
                      moodDescription.toLowerCase().includes('peaceful');
        const isFast = moodDescription.toLowerCase().includes('fast') ||
                      moodDescription.toLowerCase().includes('energetic') ||
                      moodDescription.toLowerCase().includes('exciting');
        const isClassical = moodDescription.toLowerCase().includes('classical') ||
                           moodDescription.toLowerCase().includes('piano') ||
                           moodDescription.toLowerCase().includes('violin');

        // Base frequency and tempo
        const baseFreq = isClassical ? 261.63 : 440; // C4 or A4
        const tempo = isFast ? 0.2 : (isCalm ? 0.05 : 0.1);

        // Generate simple melody
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;

            // Main tone with envelope
            const envelope = Math.exp(-t * (isCalm ? 0.5 : 1.5));

            // Simple melody: oscillate between base frequency and harmonies
            const harmonyFactor = Math.sin(t * tempo * Math.PI) * 0.5 + 0.5;
            const freq = baseFreq + (harmonyFactor * 200);

            const wave = Math.sin(2 * Math.PI * freq * t) * envelope;

            // Add slight chorus/richness with overtones
            const harmonic = Math.sin(2 * Math.PI * (freq * 1.5) * t) * envelope * 0.3;

            data[i] = (wave + harmonic) * 0.3; // Keep volume reasonable
        }

        // Create blob and object URL
        const audioBlob = new Blob([audioBuffer.getChannelData(0)], { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);

        return url;
    } catch (error) {
        console.warn("Failed to generate mood audio:", error);
        // Return a placeholder or null
        return null;
    }
};
