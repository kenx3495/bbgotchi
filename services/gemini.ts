
import { GoogleGenAI, Type } from "@google/genai";
import { TriviaQuestion, PetType } from "../types";

/**
 * Utility to handle API calls with exponential backoff for 429 errors.
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && i < maxRetries - 1) {
        console.warn(`Gemini API rate limited. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries reached");
}

export const generateAnniversaryTrivia = async (memories: string[]): Promise<TriviaQuestion[]> => {
  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Generate 5 fun, romantic multiple-choice trivia questions based on these memories: ${memories.join(", ")}. 
    Also include some general romantic anniversary trivia if there aren't enough details. 
    Each question should have 4 options and a brief explanation of why it's special.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.NUMBER },
              explanation: { type: Type.STRING }
            },
            required: ['question', 'options', 'correctIndex', 'explanation']
          }
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse trivia response", e);
      return [];
    }
  });
};

export const getPetMessage = async (petName: string, stage: string, mood: string, personality: string): Promise<string> => {
  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `You are a virtual pet kid named ${petName} at the ${stage} stage. 
    Personality: ${personality}.
    Current mood: ${mood}. 
    Say something short (under 15 words) and sweet or funny to your Dad/Mom who are celebrating their anniversary. 
    Reference your personality traits from the description! Use emojis!`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return response.text || "I love you both! Happy Anniversary! ❤️";
  });
};

export const getJournalPrompt = async (petName: string, level: number, milestone: string): Promise<string> => {
  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `The user's virtual pet "${petName}" just hit a milestone: ${milestone} (Current Level: ${level}).
    Generate a single sweet, thoughtful journal writing prompt for the couple to answer together. 
    The prompt should encourage them to reflect on their relationship or their journey with this "virtual kid".
    Keep it under 20 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return response.text || "How did you feel when you saw your pet reach this new level today?";
  });
};

export const generatePetPortrait = async (type: PetType, name: string): Promise<string | undefined> => {
  return callWithRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompts: Record<string, string> = {
      Sharkwow: "A high-quality 3D render of a cute blue turtle character based on Pokemon's Squirtle, but wearing a fun shark-themed onesie suit. Friendly face, large expressive eyes, vibrant colors, 3D animated Pixar style, clean white background.",
      Squirtle: "A high-quality 3D render of Pokemon's Squirtle, cute blue turtle character, round brown shell, smiling face, wide expressive eyes, 3D animated Pixar style, vibrant colors, clean white background.",
      Stitch: "A high-quality 3D render of Disney's Stitch, adorable blue alien, big expressive eyes, large floppy ears, friendly winking face, 3D animated Pixar style, vibrant colors, clean white background.",
      Duckson: "A high-quality 3D render of an adorable chubby white cartoon duck, round body, simple yellow beak, tiny orange feet, clean minimalist 3D animated Pixar style, vibrant colors, white background.",
      Dickson: "A high-quality 3D render of an adorable chubby brown cartoon otter character standing upright, friendly face, small ears, 3D animated Pixar style, vibrant colors, white background.",
      Sealy: "A high-quality 3D render of a cute white Japanese-style seal pup (Sirotan style), round chubby body, pink blushing cheeks, large black eyes, soft 3D texture, vibrant colors, clean white background."
    };

    const prompt = prompts[type as string] || `A high-quality 3D render of a cute cartoon character named ${name}, 3D animated Pixar style, vibrant colors, clean white background.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  });
};
