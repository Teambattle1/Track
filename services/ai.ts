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
        throw new Error("AI API Key missing. Please set GEMINI_API_KEY in Local Storage or Settings. Get a free API key at https://aistudio.google.com/app/apikey");
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

export const searchLogoUrl = async (query: string): Promise<string | null> => {
    console.log('[Logo Search] Searching internet for REAL logo:', query);

    if (!query || !query.trim()) {
        console.log('[Logo Search] Empty query');
        return null;
    }

    try {
        // Get Supabase URL and anon key from localStorage, env, or use defaults
        const supabaseUrl = typeof window !== 'undefined'
            ? (localStorage.getItem('SUPABASE_URL') || 'https://yktaxljydisfjyqhbnja.supabase.co')
            : 'https://yktaxljydisfjyqhbnja.supabase.co';

        const supabaseAnonKey = typeof window !== 'undefined'
            ? (localStorage.getItem('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdGF4bGp5ZGlzZmp5cWhibmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzQ2ODYsImV4cCI6MjA4MTcxMDY4Nn0.XeTW4vHGbEm6C7U94zMLsZiDB80cyvuqYbSRNX8oyQI')
            : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdGF4bGp5ZGlzZmp5cWhibmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzQ2ODYsImV4cCI6MjA4MTcxMDY4Nn0.XeTW4vHGbEm6C7U94zMLsZiDB80cyvuqYbSRNX8oyQI';

        console.log('[Logo Search] Calling Supabase Edge Function...');

        // Call the Edge Function for server-side logo search
        const response = await fetch(
            `${supabaseUrl}/functions/v1/search-logo`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`
                },
                body: JSON.stringify({ query: query.trim() })
            }
        );

        if (!response.ok) {
            console.error('[Logo Search] Edge Function error:', response.status);
            console.log('[Logo Search] No logo found on internet');
            return null;
        }

        const data = await response.json();

        if (data.logoUrl) {
            console.log('[Logo Search] ✅ Found REAL logo from internet via', data.source);
            return data.logoUrl;
        }

        console.log('[Logo Search] ❌ No logo found on internet for:', query);
        return null;
    } catch (error) {
        console.error('[Logo Search] Error calling Edge Function:', error);
        console.log('[Logo Search] ❌ Failed to search internet for logo');
        return null;
    }
};

export const generateAiLogo = async (companyName: string, style: string = 'professional'): Promise<string | null> => {
    try {
        console.log('[AI Logo] Generating logo for:', companyName);
        console.log('[AI Logo] Style:', style);

        // Generate a professional SVG logo with:
        // 1. Company initials as primary design
        // 2. Color gradient based on company name
        // 3. Professional styling

        const initials = companyName
            .split(/\s+/)
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        // Color palette for professional logos
        const professionalColors = [
            { bg: '#2C3E50', accent: '#3498DB' },  // Blue-gray
            { bg: '#27AE60', accent: '#2ECC71' },  // Green
            { bg: '#8E44AD', accent: '#9B59B6' },  // Purple
            { bg: '#E74C3C', accent: '#C0392B' },  // Red
            { bg: '#F39C12', accent: '#E67E22' },  // Orange
            { bg: '#1ABC9C', accent: '#16A085' },  // Teal
            { bg: '#34495E', accent: '#2C3E50' },  // Dark gray
            { bg: '#D35400', accent: '#BA4A00' },  // Dark orange
        ];

        const colorIndex = companyName.charCodeAt(0) % professionalColors.length;
        const colors = professionalColors[colorIndex];

        // SVG with professional design
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${colors.accent};stop-opacity:0.9" />
                </linearGradient>
                <filter id="shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                </filter>
            </defs>
            <!-- Background circle -->
            <circle cx="128" cy="128" r="120" fill="url(#bgGrad)" filter="url(#shadow)"/>
            <!-- Inner ring -->
            <circle cx="128" cy="128" r="110" fill="none" stroke="white" stroke-width="2" opacity="0.3"/>
            <!-- Text -->
            <text x="128" y="145" font-size="72" font-weight="bold" font-family="'Arial', 'Helvetica', sans-serif" fill="white" text-anchor="middle" letter-spacing="2">${initials}</text>
            <!-- Bottom accent line -->
            <rect x="80" y="165" width="96" height="3" rx="1.5" fill="white" opacity="0.6"/>
        </svg>`;

        const logoUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
        console.log('[AI Logo] Successfully generated professional SVG logo');
        return logoUrl;
    } catch (error: any) {
        console.error('[AI Logo] Error generating logo:', error);

        // Check if it's a missing API key error
        if (error?.message?.includes('AI API Key missing')) {
            throw error; // Re-throw to let caller handle API key modal
        }

        return null;
    }
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
