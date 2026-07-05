import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
  const chat = ai.chats.create({
    model: 'gemini-2.0-flash',
    config: {
      tools: [
        {
          functionDeclarations: [
            {
              name: 'get_weather',
              description: 'Get weather for a location',
              parameters: {
                type: 'OBJECT',
                properties: {
                  location: { type: 'STRING' },
                },
                required: ['location'],
              },
            },
          ],
        },
      ],
    },
  });

  console.log('Sending query: What is the weather in Paris?');
  const resultStream = await chat.sendMessageStream({ message: 'What is the weather in Paris?' });

  const functionCalls = [];
  for await (const chunk of resultStream) {
    const text = chunk.text;
    if (text) {
      console.log('Text chunk:', text);
    }

    const calls = chunk.functionCalls;
    if (calls) {
      console.log('Calls retrieved:', calls);
      functionCalls.push(...calls);
    }
  }

  if (functionCalls.length > 0) {
    console.log('Received function calls:', JSON.stringify(functionCalls));
    const responseParts = functionCalls.map((call) => ({
      functionResponse: {
        name: call.name,
        response: { result: 'Sunny and 22 degrees Celsius' },
      },
    }));

    console.log('Sending function response back...');
    const nextStream = await chat.sendMessageStream({ message: responseParts });
    for await (const chunk of nextStream) {
      const text = chunk.text;
      if (text) {
        console.log('Final text chunk:', text);
      }
    }
  }
}

run().catch(console.error);
