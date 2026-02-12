import Anthropic from "@anthropic-ai/sdk";
import { TaskTemplate, IconId, TaskType } from "../types";
import { normalizeLanguage } from "../utils/i18n";

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

// Get Anthropic API key (for Claude - text generation)
const getAnthropicApiKey = (): string => {
    const localKey = typeof window !== 'undefined' ? localStorage.getItem('ANTHROPIC_API_KEY') : null;
    if (localKey) return localKey;
    // Vite bakes import.meta.env.VITE_* at build time from .env or Netlify env vars
    const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    return envKey;
};

// Get Stability AI API key (for image generation)
const getStabilityApiKey = (): string => {
    const localKey = typeof window !== 'undefined' ? localStorage.getItem('STABILITY_API_KEY') : null;
    if (localKey) return localKey;
    const envKey = import.meta.env.VITE_STABILITY_API_KEY || '';
    return envKey;
};

// Check if Claude API key is available (for text generation)
export const hasApiKey = (): boolean => {
    const claudeKey = getAnthropicApiKey();
    return !!claudeKey && claudeKey.trim().length > 0;
};

// Check if Stability AI key is available (for image generation)
export const hasStabilityKey = (): boolean => {
    const key = getStabilityApiKey();
    return !!key && key.trim().length > 0;
};

// Ensure Anthropic API key exists
const ensureAnthropicApiKey = () => {
    const key = getAnthropicApiKey();
    if (!key) {
        throw new Error("Claude API Key missing. Please set ANTHROPIC_API_KEY in Settings. Get your API key at https://console.anthropic.com/");
    }
    return key;
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

export const generateAiTasks = async (
  topic: string,
  count: number = 5,
  language: string = 'English',
  additionalTag?: string,
  onProgress?: (current: number, total: number) => void
): Promise<TaskTemplate[]> => {
  // Normalize the language parameter (it may come with emoji+name format)
  const normalizedLanguage = normalizeLanguage(language);

  // Create base timestamp for all tasks in this batch
  const baseTimestamp = Date.now();

  // Try Claude first, fallback to Gemini
  const claudeKey = getAnthropicApiKey();

  let rawData: any[] = [];

  if (claudeKey) {
    // Use Claude for task generation
    console.log('[AI Tasks] Using Claude (Anthropic) for task generation');
    const anthropic = new Anthropic({ apiKey: claudeKey, dangerouslyAllowBrowser: true });

    const prompt = `Create exactly ${count} diverse scavenger hunt tasks. Topic: "${topic}". Language: ${normalizedLanguage}.

CRITICAL REQUIREMENTS:
1. For "multiple_choice" tasks: ALWAYS create 3-4 answer options in the "options" array
2. For "multiple_choice" tasks: ALWAYS mark the correct answer(s) in the "correctAnswers" array
3. For "checkbox" tasks: ALWAYS create 4-6 options and mark 2-3 correct answers in "correctAnswers" array
4. For "dropdown" tasks: ALWAYS create 4-5 options and mark the correct answer in "correctAnswers" array
5. For "boolean" tasks: The answer MUST be either "YES" or "NO" (uppercase)
6. For "text" tasks: Provide the correct answer in the "answer" field
7. If the topic/context clearly indicates a correct answer, ensure it's properly marked

Return ONLY a JSON array with objects containing these fields:
- title: string (task title)
- question: string (the question/instruction)
- type: "text" | "multiple_choice" | "boolean" | "slider" | "checkbox" | "dropdown"
- answer: string | null (for text/boolean tasks)
- options: string[] | null (for choice tasks)
- correctAnswers: string[] | null (correct options)
- numericRange: { min: number, max: number, correctValue: number } | null
- iconId: "default" | "star" | "flag" | "trophy" | "camera" | "question" | "skull" | "treasure"
- hint: string | null`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find(c => c.type === 'text');
      const responseText = textContent?.type === 'text' ? textContent.text : '';

      // Extract JSON from response (Claude might wrap it in markdown)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        rawData = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[AI Tasks] Claude error:', error);
      throw error;
    }
  }

  // No Claude key available
  if (rawData.length === 0) {
    throw new Error("Claude API Key missing. Please set ANTHROPIC_API_KEY in Settings. Get your API key at https://console.anthropic.com/");
  }

    if (!Array.isArray(rawData)) rawData = [];

    return rawData.map((item: any, index: number) => {
        // Report progress if callback provided
        if (onProgress) {
            onProgress(index + 1, rawData.length);
        }

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

        // Validate and ensure options exist for choice-based tasks
        let taskOptions = item.options;
        let taskCorrectAnswers = item.correctAnswers;

        // For multiple_choice tasks, ensure we have options and correct answers
        if (taskType === 'multiple_choice') {
            // If no options provided, create default ones
            if (!taskOptions || !Array.isArray(taskOptions) || taskOptions.length < 2) {
                console.warn(`[AI] multiple_choice task "${item.title}" missing options, adding defaults`);
                taskOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
            }

            // Ensure at least one correct answer is marked
            if (!taskCorrectAnswers || !Array.isArray(taskCorrectAnswers) || taskCorrectAnswers.length === 0) {
                console.warn(`[AI] multiple_choice task "${item.title}" missing correct answer, defaulting to first option`);
                taskCorrectAnswers = [taskOptions[0]];
            }
        }

        // For checkbox tasks (multi-select), ensure options and multiple correct answers
        if (taskType === 'checkbox') {
            if (!taskOptions || !Array.isArray(taskOptions) || taskOptions.length < 3) {
                console.warn(`[AI] checkbox task "${item.title}" missing options, adding defaults`);
                taskOptions = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'];
            }

            // Ensure at least 2 correct answers for checkbox
            if (!taskCorrectAnswers || !Array.isArray(taskCorrectAnswers) || taskCorrectAnswers.length < 2) {
                console.warn(`[AI] checkbox task "${item.title}" missing correct answers, defaulting to first two`);
                taskCorrectAnswers = [taskOptions[0], taskOptions[1]];
            }
        }

        // For dropdown tasks, ensure options and one correct answer
        if (taskType === 'dropdown') {
            if (!taskOptions || !Array.isArray(taskOptions) || taskOptions.length < 2) {
                console.warn(`[AI] dropdown task "${item.title}" missing options, adding defaults`);
                taskOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
            }

            if (!taskCorrectAnswers || !Array.isArray(taskCorrectAnswers) || taskCorrectAnswers.length === 0) {
                console.warn(`[AI] dropdown task "${item.title}" missing correct answer, defaulting to first option`);
                taskCorrectAnswers = [taskOptions[0]];
            }
        }

        // Build tags array - DO NOT include language tags
        // Language is already shown as a flag in the UI based on settings
        const tags = ['AI'];

        // Add additional tag if provided and not duplicate
        if (additionalTag && !tags.includes(additionalTag)) {
            tags.push(additionalTag);
        }

        // Log to confirm NO language tags are added
        console.log(`[AI Task] "${item.title}" - Tags: [${tags.join(', ')}] (Language is "${normalizedLanguage}", NOT added to tags)`);

        // Generate truly unique ID for each task
        // Use current timestamp + index + two random suffixes for maximum uniqueness
        const uniqueTimestamp = Date.now() + index; // Add index to timestamp to ensure uniqueness even in same millisecond
        const randomSuffix1 = Math.random().toString(36).substring(2, 9);
        const randomSuffix2 = Math.random().toString(36).substring(2, 6);

        return {
            id: `ai-${uniqueTimestamp}-${randomSuffix1}${randomSuffix2}`,
            title: item.title,
            iconId: (item.iconId as IconId) || 'default',
            tags: tags,
            createdAt: baseTimestamp,
            points: 100,
            activationTypes: ['click'], // Default to click activation for all AI tasks
            task: {
                type: taskType,
                question: item.question,
                answer: taskAnswer,
                options: taskOptions,
                correctAnswers: taskCorrectAnswers,
                range: item.numericRange ? { ...item.numericRange, step: 1, tolerance: 0 } : undefined
            },
            feedback: {
                correctMessage: 'Correct!', showCorrectMessage: true,
                incorrectMessage: 'Try again!', showIncorrectMessage: true,
                hint: item.hint || '', hintCost: -50
            },
            settings: {
                scoreDependsOnSpeed: false, language: normalizedLanguage, showAnswerStatus: true, showCorrectAnswerOnMiss: false
            }
        };
    });
};

export const generateAiImage = async (prompt: string, style: string = 'cartoon'): Promise<string | null> => {
    // Danish to English translations
    const translations: Record<string, string> = {
        'sne': 'snow', 'ski': 'skiing', 'strand': 'beach', 'skov': 'forest',
        'by': 'city', 'hav': 'ocean', 'bjerg': 'mountain', 'mad': 'food',
        'musik': 'music', 'sport': 'sports', 'natur': 'nature', 'dyr': 'animals',
        'blomster': 'flowers', 'sol': 'sun', 'regn': 'rain', 'vinter': 'winter',
        'sommer': 'summer', 'forår': 'spring', 'efterår': 'autumn', 'kunst': 'art',
        'eventyr': 'adventure', 'spil': 'game', 'fest': 'party', 'løb': 'running',
        'hold': 'team', 'konkurrence': 'competition', 'opgave': 'task', 'mission': 'mission'
    };

    // Translate Danish words to English
    const words = prompt.toLowerCase().split(/\s+/);
    const translatedWords = words.map(w => translations[w] || w);
    const englishPrompt = translatedWords.join(' ');

    // Try Stability AI first if key is available (v2beta API)
    const stabilityKey = getStabilityApiKey();
    if (stabilityKey) {
        try {
            console.log('[AI Image] Generating with Stability AI v2beta:', englishPrompt);

            const formData = new FormData();
            formData.append('prompt', `${englishPrompt}, ${style} style, vibrant colors, clean design, suitable for mobile app icon`);
            formData.append('negative_prompt', 'blurry, bad quality, text, watermark, signature');
            formData.append('output_format', 'png');
            formData.append('aspect_ratio', '1:1');

            const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${stabilityKey}`,
                    'Accept': 'application/json'
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[AI Image] Stability AI error:', response.status, errorText);
                throw new Error(`Stability AI error: ${response.status}`);
            }

            const data = await response.json();
            if (data?.image) {
                console.log('[AI Image] Stability AI v2beta success!');
                return `data:image/png;base64,${data.image}`;
            }
            // Fallback: check old format too
            if (data?.artifacts && Array.isArray(data.artifacts) && data.artifacts[0]?.base64) {
                console.log('[AI Image] Stability AI success (legacy format)!');
                return `data:image/png;base64,${data.artifacts[0].base64}`;
            }

            console.warn('[AI Image] No image in Stability response, data:', JSON.stringify(data).slice(0, 200));
        } catch (e: any) {
            console.error('[AI Image] Stability AI failed:', e.message);
            // Fall through to placeholder fallback
        }
    }

    // Fallback to placeholder image with theme color
    // Note: Unsplash source API is unreliable, use a simple colored placeholder
    console.log('[AI Image] Stability AI unavailable, using placeholder for:', englishPrompt);

    // Generate a simple SVG placeholder with theme-based color
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const colorIndex = englishPrompt.charCodeAt(0) % colors.length;
    const bgColor = colors[colorIndex];
    const initials = englishPrompt.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="512" height="512" fill="${bgColor}"/>
        <text x="256" y="280" font-size="120" font-weight="bold" font-family="Arial, sans-serif" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text>
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const generateAvatar = async (keywords: string): Promise<string | null> => {
    return generateAiImage(`Avatar of ${keywords}`, 'vector art, colorful, circular crop style');
};

export const generateAiBackground = async (keywords: string, zoneName?: string): Promise<string | null> => {
    // Danish to English translations
    const translations: Record<string, string> = {
        'sne': 'snow', 'ski': 'skiing', 'strand': 'beach', 'skov': 'forest',
        'by': 'city', 'hav': 'ocean', 'bjerg': 'mountain', 'mad': 'food',
        'musik': 'music', 'sport': 'sports', 'natur': 'nature', 'dyr': 'animals',
        'blomster': 'flowers', 'sol': 'sun', 'regn': 'rain', 'vinter': 'winter',
        'sommer': 'summer', 'forår': 'spring', 'efterår': 'autumn', 'kunst': 'art',
        'eventyr': 'adventure', 'spil': 'game', 'fest': 'party', 'løb': 'running'
    };

    const words = keywords.toLowerCase().split(/\s+/);
    const translatedWords = words.map(w => translations[w] || w);
    const englishKeywords = translatedWords.join(' ');

    // Try Stability AI first if key is available (v2beta API)
    const stabilityKey = getStabilityApiKey();
    if (stabilityKey) {
        try {
            const zoneContext = zoneName ? ` for ${zoneName}` : '';
            console.log('[AI Background] Generating with Stability AI v2beta:', englishKeywords);

            const formData = new FormData();
            formData.append('prompt', `Wide panoramic game background${zoneContext}, theme: ${englishKeywords}, vibrant colors, adventure game style`);
            formData.append('negative_prompt', 'text, watermark, signature, ui elements, blurry');
            formData.append('output_format', 'png');
            formData.append('aspect_ratio', '16:9');

            const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${stabilityKey}`,
                    'Accept': 'application/json'
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[AI Background] Stability AI error:', response.status, errorText);
                throw new Error(`Stability AI error: ${response.status}`);
            }

            const data = await response.json();
            if (data?.image) {
                console.log('[AI Background] Stability AI v2beta success!');
                return `data:image/png;base64,${data.image}`;
            }
            if (data.artifacts && data.artifacts[0]?.base64) {
                console.log('[AI Background] Stability AI success (legacy format)!');
                return `data:image/png;base64,${data.artifacts[0].base64}`;
            }
        } catch (e: any) {
            console.error('[AI Background] Stability AI failed:', e.message);
        }
    }

    // Fallback to gradient placeholder
    console.log('[AI Background] Stability AI unavailable, using gradient placeholder for:', englishKeywords);

    // Generate a simple gradient SVG placeholder
    const gradients = [
        ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
        ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#30cfd0', '#330867']
    ];
    const gradientIndex = englishKeywords.charCodeAt(0) % gradients.length;
    const [color1, color2] = gradients[gradientIndex];

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1344" height="768" viewBox="0 0 1344 768">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${color1}"/>
                <stop offset="100%" style="stop-color:${color2}"/>
            </linearGradient>
        </defs>
        <rect width="1344" height="768" fill="url(#bg)"/>
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
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

        // Try Stability AI for logo generation (v2beta API)
        const stabilityKey = getStabilityApiKey();
        if (stabilityKey) {
            try {
                const promptText = `Professional modern company logo for "${companyName}", ${style}, clean minimalist design, bold colors, square format, white background, vector art style`;
                console.log('[AI Logo] Generating with Stability AI v2beta...');

                const formData = new FormData();
                formData.append('prompt', promptText);
                formData.append('negative_prompt', 'blurry, bad quality, text, watermark, complex, cluttered, photograph');
                formData.append('output_format', 'png');
                formData.append('aspect_ratio', '1:1');

                const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${stabilityKey}`,
                        'Accept': 'application/json'
                    },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data?.image) {
                        console.log('[AI Logo] ✅ Stability AI v2beta logo generated successfully');
                        return `data:image/png;base64,${data.image}`;
                    }
                    if (data?.artifacts?.[0]?.base64) {
                        console.log('[AI Logo] ✅ Stability AI logo generated (legacy format)');
                        return `data:image/png;base64,${data.artifacts[0].base64}`;
                    }
                } else {
                    const errorText = await response.text();
                    console.warn('[AI Logo] Stability AI error:', response.status, errorText);
                }
            } catch (aiError) {
                console.warn('[AI Logo] Stability AI failed, falling back to SVG:', aiError);
            }
        } else {
            console.log('[AI Logo] No Stability API key, using SVG fallback');
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
    const normalizedLanguage = normalizeLanguage(targetLanguage);

    const prompt = `Translate this task content to ${normalizedLanguage}. Maintain the meaning and context. Return ONLY a JSON object with the same structure.

Task Content:
${JSON.stringify(content, null, 2)}

IMPORTANT: Return ONLY the translated JSON object. No additional text or explanations.`;

    const claudeKey = ensureAnthropicApiKey();
    console.log('[AI Translation] Using Claude');
    const anthropic = new Anthropic({ apiKey: claudeKey, dangerouslyAllowBrowser: true });

    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const translatedContent = JSON.parse(jsonMatch[0]);
        return {
            question: translatedContent.question || content.question,
            options: translatedContent.options || content.options,
            answer: translatedContent.answer || content.answer,
            correctAnswers: translatedContent.correctAnswers || content.correctAnswers,
            placeholder: translatedContent.placeholder || content.placeholder,
            feedback: translatedContent.feedback || content.feedback,
        };
    }

    throw new Error("Translation failed - no valid JSON response from Claude.");
};

// Generate a mood-based audio vignette using Web Audio API (BETA - no API required)
export const generateMoodAudio = async (topic: string): Promise<string | null> => {
    try {
        // Analyze topic keywords to determine mood (no API call needed)
        const topicLower = topic.toLowerCase();

        // Mood detection from keywords
        const isCalm = /nature|forest|ocean|calm|peace|relax|zen|meditation|spa/.test(topicLower);
        const isEnergetic = /sport|race|run|adventure|party|dance|action|fast|extreme/.test(topicLower);
        const isMysterious = /mystery|secret|treasure|hidden|dark|night|detective/.test(topicLower);
        const isHappy = /happy|fun|joy|celebrate|birthday|festival|carnival/.test(topicLower);
        const isEpic = /epic|hero|battle|quest|warrior|champion|victory/.test(topicLower);

        // Create audio using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const duration = 2.0; // 2 seconds
        const sampleRate = audioContext.sampleRate;
        const samples = Math.floor(duration * sampleRate);

        const audioBuffer = audioContext.createBuffer(2, samples, sampleRate); // Stereo
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);

        // Select musical parameters based on mood
        let baseFreq = 440; // A4
        let decayRate = 1.0;
        let harmonicRichness = 0.3;

        if (isCalm) {
            baseFreq = 261.63; // C4 - calming
            decayRate = 0.5;
            harmonicRichness = 0.2;
        } else if (isEnergetic) {
            baseFreq = 329.63; // E4 - energetic
            decayRate = 2.0;
            harmonicRichness = 0.5;
        } else if (isMysterious) {
            baseFreq = 220; // A3 - darker
            decayRate = 0.8;
            harmonicRichness = 0.4;
        } else if (isHappy) {
            baseFreq = 392; // G4 - bright
            decayRate = 1.2;
            harmonicRichness = 0.35;
        } else if (isEpic) {
            baseFreq = 293.66; // D4 - powerful
            decayRate = 0.7;
            harmonicRichness = 0.45;
        }

        // Generate a simple melodic phrase
        const notes = [1, 1.25, 1.5, 1.25, 1]; // Simple up-down pattern
        const noteLength = samples / notes.length;

        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const noteIndex = Math.floor(i / noteLength);
            const noteT = (i % noteLength) / noteLength;

            const freq = baseFreq * notes[noteIndex % notes.length];

            // Envelope: attack-decay for each note
            const attack = Math.min(noteT * 10, 1);
            const decay = Math.exp(-noteT * decayRate * 3);
            const envelope = attack * decay;

            // Main tone
            const wave = Math.sin(2 * Math.PI * freq * t);

            // Harmonics for richness
            const h2 = Math.sin(2 * Math.PI * freq * 2 * t) * harmonicRichness * 0.5;
            const h3 = Math.sin(2 * Math.PI * freq * 3 * t) * harmonicRichness * 0.25;

            // Slight stereo spread
            const stereoPhase = Math.sin(t * 2) * 0.1;

            const sample = (wave + h2 + h3) * envelope * 0.25;
            leftChannel[i] = sample * (1 + stereoPhase);
            rightChannel[i] = sample * (1 - stereoPhase);
        }

        // Fade out last 10%
        const fadeStart = Math.floor(samples * 0.9);
        for (let i = fadeStart; i < samples; i++) {
            const fade = 1 - (i - fadeStart) / (samples - fadeStart);
            leftChannel[i] *= fade;
            rightChannel[i] *= fade;
        }

        // Convert to WAV format
        const wavBuffer = audioBufferToWav(audioBuffer);
        const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);

        return url;
    } catch (error) {
        console.warn("[Audio] Failed to generate mood audio:", error);
        return null;
    }
};

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const samples = buffer.length;
    const dataSize = samples * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels and write samples
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < samples; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    return arrayBuffer;
}
