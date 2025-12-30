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

  // Normalize the language parameter (it may come with emoji+name format)
  const normalizedLanguage = normalizeLanguage(language);

  try {
    const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create exactly ${count} diverse scavenger hunt tasks. Topic: "${topic}". Language: ${normalizedLanguage}. Return JSON array.`,
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
        tags: ['AI', normalizedLanguage, ...(additionalTag ? [additionalTag] : [])],
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
          scoreDependsOnSpeed: false, language: normalizedLanguage, showAnswerStatus: true, showCorrectAnswerOnMiss: false
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

export const generateAiBackground = async (keywords: string, zoneName?: string): Promise<string | null> => {
    const key = ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: key });

    // Use the keywords provided by the user and optionally include zone name for context
    const zoneContext = zoneName ? ` for game zone "${zoneName}"` : '';
    const prompt = `Create a vibrant widescreen game background image${zoneContext}. Theme and elements: ${keywords}. 16:9 landscape format. Bright, colorful, engaging scene suitable for adventure game.`;

    try {
        console.log('[AI Background] Generating with Gemini 2.5 Flash Image');
        console.log('[AI Background] Keywords:', keywords);
        console.log('[AI Background] Full prompt:', prompt);

        // NOTE: Imagen 3 (imagen-3.0-generate-002) is only available through Vertex AI, not the Gemini Developer API
        // To use Imagen 3, you would need to:
        // 1. Set up Google Cloud Project with billing
        // 2. Enable Vertex AI API
        // 3. Use: new GoogleGenAI({ vertexai: true, project: 'project-id', location: 'us-central1' })
        // 4. Then call: ai.models.generateImages({ model: 'imagen-3.0-generate-002', ... })
        //
        // For now, we use Gemini 2.5 Flash Image which works with API keys
        const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
        }));

        console.log('[AI Background] Response received:', {
            hasCandidates: !!response.candidates,
            candidateCount: response.candidates?.length,
            finishReason: response.candidates?.[0]?.finishReason
        });

        const candidate = response.candidates?.[0];

        // Extract image from Gemini response (inlineData format)
        if (candidate?.content?.parts?.[0]?.inlineData) {
            const inlineData = candidate.content.parts[0].inlineData;
            console.log('[AI Background] Successfully generated image');
            return `data:${inlineData.mimeType};base64,${inlineData.data}`;
        }

        // Log detailed info if no image
        console.warn('[AI Background] No image data in response');
        console.log('[AI Background] Response structure:', {
            finishReason: candidate?.finishReason,
            hasSafetyRatings: !!candidate?.safetyRatings,
            safetyRatings: candidate?.safetyRatings,
            contentParts: candidate?.content?.parts?.map(p => ({
                hasText: !!p.text,
                hasInlineData: !!p.inlineData,
                text: p.text?.substring(0, 100)
            }))
        });

        return null;
    } catch (e: any) {
        console.error('[AI Background] Error generating:', e);
        console.error('[AI Background] Error details:', {
            message: e.message,
            status: e.status,
            errorDetails: e.errorDetails
        });
        return null;
    }
};

// Smart domain extraction from company name
const guessDomain = (query: string): string => {
    const normalized = query.toLowerCase().trim();

    // Remove common suffixes and legal terms
    const cleaned = normalized
        .replace(/\s+(a\/s|aps|as|inc|llc|ltd|limited|corp|corporation|gmbh|ab)\s*$/i, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '');

    // Special cases for known Danish/Nordic companies
    const specialCases: { [key: string]: string } = {
        'tv2': 'tv2.dk',
        'dr': 'dr.dk',
        'berlingske': 'berlingske.dk',
        'politiken': 'politiken.dk',
        'bt': 'bt.dk',
        'ekstrabl': 'ekstrabladet.dk',
        'ekstrabladet': 'ekstrabladet.dk',
        'jyllandsposten': 'jyllandsposten.dk',
        'jp': 'jyllandsposten.dk'
    };

    if (specialCases[cleaned]) {
        return specialCases[cleaned];
    }

    // For multi-word names, try first word if it makes sense
    if (normalized.includes(' ')) {
        const words = normalized.split(/\s+/);
        const firstWord = words[0].replace(/[^a-z0-9]/g, '');

        // If first word is substantial (4+ chars), use it
        if (firstWord.length >= 4) {
            return `${firstWord}.com`;
        }
    }

    // Default: cleaned name + .com
    return `${cleaned}.com`;
};

export const searchLogoUrl = async (query: string): Promise<string | null> => {
    console.log('[Logo Search] Starting search for:', query);

    // Generate best domain guess
    const domain = guessDomain(query);
    console.log('[Logo Search] Guessed domain:', domain);

    // Return Clearbit URL
    // The browser will handle loading - if it fails, the img onError handler will try Google favicon
    // This avoids CORS issues from pre-flight verification
    const logoUrl = `https://logo.clearbit.com/${domain}`;

    console.log('[Logo Search] Using Clearbit logo:', logoUrl);
    return logoUrl;
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
