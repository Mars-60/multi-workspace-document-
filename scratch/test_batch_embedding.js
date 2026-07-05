import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log('Testing embedContent with text-embedding-004...');
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: 'hello',
    });
    console.log('embedContent succeeded! size:', response.embeddings[0].values.length);
  } catch (err) {
    console.error('embedContent failed:', err);
  }

  console.log('Testing batch embedContent with text-embedding-004...');
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: ['hello', 'world'],
    });
    console.log('embedContent batch succeeded! length:', response.embeddings.length);
    console.log('Embedding 0 size:', response.embeddings[0].values.length);
  } catch (err) {
    console.error('embedContent batch failed:', err);
  }
}

run().catch(console.error);
