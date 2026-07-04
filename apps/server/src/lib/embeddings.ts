import { GoogleGenerativeAI } from '@google/generative-ai';

import env from '../config/env.js';

const apiKey = env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function embedText(text: string) {
  if (!client) {
    if (env.NODE_ENV !== 'production') {
      const seed = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return Array.from({ length: 16 }, (_, index) => ((seed + index * 31) % 997) / 997);
    }
    throw new Error('Gemini API key is not configured');
  }

  const model = client.getGenerativeModel({ model: env.GEMINI_EMBEDDING_MODEL });
  const response = await model.embedContent(text);
  return response.embedding.values;
}
