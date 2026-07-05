import { GoogleGenAI } from '@google/genai';

import env from '../config/env.js';

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

export async function embedText(text: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key');
  }

  const response = await ai.models.embedContent({
    model: env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
    contents: text,
  });

  const embeddings = response.embeddings;
  if (!embeddings || !embeddings[0] || !embeddings[0].values) {
    throw new Error('Failed to generate embedding values from model response');
  }

  return embeddings[0].values;
}
