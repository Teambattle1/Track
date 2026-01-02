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
      contents: `Create exactly ${count} diverse scavenger hunt tasks. Topic: "${topic}". Language: ${normalizedLanguage}.
IMPORTANT: For tasks with type "boolean", the answer MUST be either "YES" or "NO" (uppercase).
Return JSON array.`,
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

    return rawData.map((item: any, index: number) => {
        const taskType = (item.type as TaskType) || 'text';

        // For boolean tasks, ensure answer is valid YES or NO
        let taskAnswer = item.answer;
        if (taskType === 'boolean') {
            // Normalize the answer to YES or NO
            if (!taskAnswer || (taskAnswer.toUpperCase() !== 'YES' && taskAnswer.toUpperCase() !== 'NO')) {
                // Default to YES if AI didn't provide a valid answer
                taskAnswer = 'YES';
            } else {
                taskAnswer = taskAnswer.toUpperCase();
            }
        }

        return {
            id: `ai-${Date.now()}-${index}`,
            title: item.title,
            iconId: (item.iconId as IconId) || 'default',
            tags: ['AI', normalizedLanguage, ...(additionalTag ? [additionalTag] : [])],
            createdAt: Date.now(),
            points: 100,
            activationTypes: ['click'], // Default to click activation for all AI tasks
            task: {
                type: taskType,
                question: item.question,
                answer: taskAnswer,
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
        };
    });
  } catch (error) {
    console.error("AI Generation Error", error);
    throw error;
  }
};

export const generateAiImage = async (prompt: string, style: string = 'cartoon'): Promise<string | null> => {
    const key = ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: key });

    const fullPrompt = `Simple vector illustration: ${prompt}. Style: ${style}. Minimal background.`;

    try {
        console.log('[AI Image] Generating with Gemini 2.5 Flash Image');
        console.log('[AI Image] Prompt:', fullPrompt);

        const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: fullPrompt,
        }));

        console.log('[AI Image] Response received:', {
            hasCandidates: !!response.candidates,
            candidateCount: response.candidates?.length,
            finishReason: response.candidates?.[0]?.finishReason
        });

        const candidate = response.candidates?.[0];

        if (candidate?.content?.parts?.[0]?.inlineData) {
            const inlineData = candidate.content.parts[0].inlineData;
            console.log('[AI Image] Successfully generated image');
            return `data:${inlineData.mimeType};base64,${inlineData.data}`;
        }

        console.warn('[AI Image] No image data in response');
        console.log('[AI Image] Response structure:', {
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
        console.error('[AI Image] Error generating:', e);
        console.error('[AI Image] Error details:', {
            message: e.message,
            status: e.status,
            errorDetails: e.errorDetails
        });
        throw e; // Re-throw to allow caller to handle
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
    console.log('[Logo Search] 🔍 Searching for REAL company logo:', query);

    if (!query || !query.trim()) {
        console.log('[Logo Search] ❌ Empty query');
        return null;
    }

    const normalizedQuery = query.trim();

    try {
        // Use Supabase Edge Function to bypass CORS restrictions
        const supabaseUrl = typeof window !== 'undefined'
            ? (localStorage.getItem('SUPABASE_URL') || 'https://yktaxljydisfjyqhbnja.supabase.co')
            : 'https://yktaxljydisfjyqhbnja.supabase.co';

        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/logo-search`;

        console.log('[Logo Search] 📡 Calling Edge Function:', edgeFunctionUrl);

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: normalizedQuery })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.log('[Logo Search] ❌ Edge Function error:', error);
            return null;
        }

        const data = await response.json();

        if (data.logoUrl) {
            console.log('[Logo Search] ✅ Found REAL logo via', data.source);
            return data.logoUrl;
        }

        console.log('[Logo Search] ❌ No logo found for:', query);
        return null;

    } catch (error) {
        console.error('[Logo Search] ❌ Error:', error);
        return null;
    }
};


export const generateAiLogo = async (companyName: string, style: string = 'professional'): Promise<string | null> => {
    try {
        console.log('[AI Logo] 🎨 Generating AI logo for:', companyName);
        console.log('[AI Logo] Style:', style);

        // Try to use Gemini AI to generate actual logo image
        const key = getApiKey();

        if (key) {
            try {
                const ai = new GoogleGenAI({ apiKey: key });

                const prompt = `Create a professional, modern company logo for "${companyName}".
                    Design requirements:
                    - Clean, minimalist design
                    - Professional corporate look
                    - Use company name or relevant symbolism
                    - Bold colors and clear shapes
                    - Square format, white or transparent background
                    - High contrast, suitable for web use
                    Style: ${style}, vector art style`;

                console.log('[AI Logo] Calling Gemini AI to generate logo image...');

                const response = await makeRequestWithRetry<GenerateContentResponse>(() =>
                    ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: prompt,
                    })
                );

                // Extract image from response
                if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                    const inlineData = response.candidates[0].content.parts[0].inlineData;
                    console.log('[AI Logo] ✅ Generated AI logo image successfully');
                    return `data:${inlineData.mimeType};base64,${inlineData.data}`;
                } else {
                    console.warn('[AI Logo] No image in AI response, falling back to SVG');
                }
            } catch (aiError) {
                console.warn('[AI Logo] Gemini AI failed, falling back to SVG:', aiError);
            }
        } else {
            console.log('[AI Logo] No API key found, using SVG fallback');
        }

        // Fallback: Generate a professional branded SVG logo
        console.log('[AI Logo] Generating SVG fallback logo...');
        const initials = companyName
            .split(/\s+/)
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        // Color palette - professional and diverse
        const brandColors = [
            { bg: '#FF6B6B', accent: '#D63031' },  // Red/Coral
            { bg: '#4ECDC4', accent: '#1ABC9C' },  // Teal
            { bg: '#45B7D1', accent: '#0984E3' },  // Sky Blue
            { bg: '#FFA07A', accent: '#FF7675' },  // Salmon
            { bg: '#98D8C8', accent: '#6C5CE7' },  // Mint
            { bg: '#F7DC6F', accent: '#F39C12' },  // Gold
            { bg: '#BB8FCE', accent: '#A29BFE' },  // Purple
            { bg: '#85C1E2', accent: '#74B9FF' },  // Light Blue
            { bg: '#F8B88B', accent: '#FF7675' },  // Peach
            { bg: '#52C9A8', accent: '#00B894' },  // Green
        ];

        const colorIndex = companyName.charCodeAt(0) % brandColors.length;
        const colors = brandColors[colorIndex];

        // Professional SVG logo with gradients and styling
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
            <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${colors.accent};stop-opacity:1" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <!-- Background -->
            <rect width="256" height="256" fill="${colors.bg}"/>
            <!-- Main circle -->
            <circle cx="128" cy="128" r="110" fill="url(#logoGrad)" filter="url(#glow)"/>
            <!-- Accent ring -->
            <circle cx="128" cy="128" r="100" fill="none" stroke="white" stroke-width="2" opacity="0.4"/>
            <!-- Initials text -->
            <text x="128" y="150" font-size="80" font-weight="900" font-family="'Segoe UI', 'Arial', sans-serif" fill="white" text-anchor="middle" dominant-baseline="middle" letter-spacing="3">${initials}</text>
        </svg>`;

        const logoUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
        console.log('[AI Logo] ✅ Generated SVG logo');
        return logoUrl;
    } catch (error: any) {
        console.error('[AI Logo] Error generating logo:', error);
        return null;
    }
};

// Translate task content to a target language
export const translateTaskContent = async (
    content: {
        question: string;
        options?: string[];
        answer?: string;
        correctAnswers?: string[];
        placeholder?: string;
        feedback?: {
            correctMessage: string;
            incorrectMessage: string;
            hint: string;
        };
    },
    targetLanguage: string
): Promise<{
    question: string;
    options?: string[];
    answer?: string;
    correctAnswers?: string[];
    placeholder?: string;
    feedback?: {
        correctMessage: string;
        incorrectMessage: string;
        hint: string;
    };
}> => {
    const key = ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: key });

    const normalizedLanguage = normalizeLanguage(targetLanguage);

    try {
        const prompt = `Translate this task content to ${normalizedLanguage}. Maintain the meaning and context. Return ONLY a JSON object with the same structure.

Task Content:
${JSON.stringify(content, null, 2)}

IMPORTANT: Return ONLY the translated JSON object. No additional text or explanations.`;

        const response = await makeRequestWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            },
        }));

        const translatedContent = JSON.parse(response.text || "{}");

        return {
            question: translatedContent.question || content.question,
            options: translatedContent.options || content.options,
            answer: translatedContent.answer || content.answer,
            correctAnswers: translatedContent.correctAnswers || content.correctAnswers,
            placeholder: translatedContent.placeholder || content.placeholder,
            feedback: translatedContent.feedback || content.feedback,
        };
    } catch (error) {
        console.error("AI Translation Error", error);
        throw error;
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
