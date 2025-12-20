
import { GoogleGenAI, Type } from "@google/genai";
import { TaskTemplate, IconId, TaskType } from "../types";

// Initialize Gemini
// Note: In a production environment, API calls should ideally go through a backend proxy to hide the key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const generateAiTasks = async (topic: string, count: number = 10, language: string = 'English', additionalTag?: string): Promise<TaskTemplate[]> => {
  // Create a timeout promise (20 seconds)
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error("Request timed out. The AI model is taking too long to respond."));
    }, 20000);
  });

  try {
    const apiCallPromise = ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate ${count} engaging scavenger hunt / quiz tasks about: "${topic}".
      
      Language: The content (title, question, options, answers, hints) MUST be in ${language}.
      
      Guidelines:
      1. Make them fun and varied.
      2. Use a mix of types (multiple_choice, text, boolean, slider, etc).
      3. For 'slider', provide a numeric range and correct value.
      4. For 'checkbox', provide multiple correct options.
      5. Ensure 'iconId' matches the theme of the question.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are a creative game designer for a physical GPS location game called GeoHunt. Create fun, bite-sized tasks.",
      },
    });

    // Race the API call against the timeout
    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    const rawData = JSON.parse(response.text || "[]");

    // Map the raw JSON to our TypeScript TaskTemplate structure
    return rawData.map((item: any, index: number) => {
      const tags = ['ai-generated', ...topic.split(' ').map(s => s.toLowerCase())];
      if (additionalTag && additionalTag.trim()) {
          tags.push(additionalTag.trim());
      }
      // Add language as a tag for easier filtering
      if (language) {
          tags.push(language);
      }

      return {
        id: `ai-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        title: item.title,
        iconId: item.iconId as IconId,
        tags: tags,
        createdAt: Date.now(),
        points: 100,
        task: {
          type: item.type as TaskType,
          question: item.question,
          answer: item.answer,
          options: item.options,
          correctAnswers: item.correctAnswers,
          range: item.numericRange ? {
            min: item.numericRange.min,
            max: item.numericRange.max,
            step: 1,
            correctValue: item.numericRange.correctValue,
            tolerance: Math.max(1, Math.round((item.numericRange.max - item.numericRange.min) * 0.1)) // 10% tolerance
          } : undefined
        },
        feedback: {
          correctMessage: "Correct! Well done.",
          showCorrectMessage: true,
          incorrectMessage: "That's not right, try again.",
          showIncorrectMessage: true,
          hint: item.hint || "No hint available.",
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
    console.error("AI Generation failed:", error);
    throw error; 
  }
};

export const generateAiImage = async (prompt: string, type: 'scavenger' | 'logo' = 'scavenger'): Promise<string | null> => {
  try {
    let textPrompt = `Create a realistic yet fun image for a scavenger hunt task. Context: ${prompt}`;
    if (type === 'logo') {
        textPrompt = `Create a professional, modern, and clean logo design for: ${prompt}. The logo should be on a white background or have transparency if possible.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: textPrompt,
          },
        ],
      },
    });
    
    // Find the image part
    for (const part of response.candidates?.[0]?.content?.parts || []) {
       if (part.inlineData) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
       }
    }
    return null;
  } catch (e) {
    console.error("Image gen failed", e);
    return null;
  }
};

export const findCompanyDomain = async (topic: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find the official website domain for: "${topic}".
      Return ONLY the domain name (e.g. 'lego.com' or 'apple.com').
      Do not include 'https://' or 'www.' or any path.
      If no clear brand/company is found, return 'NOT_FOUND'.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text?.trim() || '';
    if (text.includes('NOT_FOUND')) return null;

    // Extract domain (simplified but robust)
    // Matches something.something (min 2 chars each)
    const match = text.match(/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/i);
    let domain = match ? match[0] : null;

    if (!domain) return null;
    
    // Cleanup if any leftovers
    domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

    return domain;
  } catch (error) {
    console.error("Domain search failed:", error);
    return null;
  }
};

export const generateTaskFromImage = async (base64Image: string): Promise<TaskTemplate | null> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Using vision model
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64Image.split(',')[1] // Remove data:image/jpeg;base64, prefix
                        }
                    },
                    {
                        text: `Analyze this image and create a single fun scavenger hunt task based on what you see. 
                        Return JSON format ONLY:
                        {
                            "title": "Short Title",
                            "question": "The question or challenge...",
                            "type": "text" | "multiple_choice" | "boolean",
                            "options": ["opt1", "opt2"] (only if multiple_choice),
                            "answer": "Correct Answer",
                            "hint": "Hint...",
                            "iconId": "camera" | "question" | "star"
                        }`
                    }
                ]
            }
        });

        // Parse response (handle Markdown code blocks)
        let text = response.text || '';
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);

        return {
            id: `ai-img-${Date.now()}`,
            title: data.title || "Image Task",
            task: {
                type: (data.type as TaskType) || 'text',
                question: data.question || "What do you see?",
                options: data.options,
                answer: data.answer,
                imageUrl: base64Image // Attach the original image
            },
            iconId: (data.iconId as IconId) || 'camera',
            tags: ['image-generated'],
            createdAt: Date.now(),
            points: 100,
            feedback: {
                correctMessage: 'Correct!',
                showCorrectMessage: true,
                incorrectMessage: 'Incorrect, try again.',
                showIncorrectMessage: true,
                hint: data.hint || '',
                hintCost: 10
            },
            settings: {
                language: 'English',
                scoreDependsOnSpeed: false,
                showAnswerStatus: true,
                showCorrectAnswerOnMiss: false
            }
        };
    } catch (e) {
        console.error("Image to task failed", e);
        return null;
    }
};
