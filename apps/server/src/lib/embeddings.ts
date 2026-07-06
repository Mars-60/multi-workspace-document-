import { GoogleGenAI } from '@google/genai';

import env from '../config/env.js';

import { createLogger } from './logger.js';

const logger = createLogger('embeddings');

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

export async function embedText(text: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key');
  }

  const model = env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

  let response;
  try {
    response = await ai.models.embedContent({
      model,
      contents: text,
      config: {
        // Keep 768 dims so existing chunks (text-embedding-004 era) stay
        // compatible with new queries; gemini-embedding-001 defaults to 3072.
        outputDimensionality: 768,
      },
    });
  } catch (err: unknown) {
    // Surface HTTP status + body so model-name errors are diagnosable in logs
    const status = (err as Record<string, unknown>)?.status;
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ model, status, message }, 'embedContent API call failed');
    throw new Error(
      `Embedding API error (model=${model}, status=${status ?? 'unknown'}): ${message}`,
    );
  }

  const embeddings = response.embeddings;
  if (!embeddings || !embeddings[0] || !embeddings[0].values) {
    throw new Error(`Failed to generate embedding values from model response (model=${model})`);
  }

  return embeddings[0].values;
}
