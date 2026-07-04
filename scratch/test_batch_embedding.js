import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });

async function run() {
  console.log("Testing embedContent with gemini-embedding-2...");
  try {
    const response = await model.embedContent('hello');
    console.log("embedContent succeeded! size:", response.embedding.values.length);
  } catch (err) {
    console.error("embedContent failed:", err);
  }

  console.log("Testing batchEmbedContents with gemini-embedding-2...");
  try {
    const response = await model.batchEmbedContents({
      requests: [
        { model: 'models/gemini-embedding-2', content: { role: 'user', parts: [{ text: 'hello' }] } },
        { model: 'models/gemini-embedding-2', content: { role: 'user', parts: [{ text: 'world' }] } },
      ],
    });
    console.log("batchEmbedContents succeeded! length:", response.embeddings.length);
    console.log("Embedding 0 size:", response.embeddings[0].values.length);
  } catch (err) {
    console.error("batchEmbedContents failed:", err);
  }
}

run().catch(console.error);
