import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
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
});

async function run() {
  const chat = model.startChat({ history: [] });
  console.log("Sending query: What is the weather in Paris?");
  const resultStream = await chat.sendMessageStream("What is the weather in Paris?");
  
  let functionCalls = [];
  for await (const chunk of resultStream.stream) {
    const text = chunk.text();
    if (text) {
      console.log("Text chunk:", text);
    }
    
    // Check if chunk.functionCalls is a method or property
    console.log("chunk.functionCalls type:", typeof chunk.functionCalls);
    const calls = typeof chunk.functionCalls === 'function' ? chunk.functionCalls() : chunk.functionCalls;
    if (calls) {
      console.log("Calls retrieved:", calls);
      functionCalls.push(...calls);
    }
  }

  if (functionCalls.length > 0) {
    console.log("Received function calls:", JSON.stringify(functionCalls));
    const responseParts = functionCalls.map(call => ({
      functionResponse: {
        name: call.name,
        response: { result: "Sunny and 22 degrees Celsius" },
      }
    }));
    
    console.log("Sending function response back...");
    const nextStream = await chat.sendMessageStream(responseParts);
    for await (const chunk of nextStream.stream) {
      const text = chunk.text();
      if (text) {
        console.log("Final text chunk:", text);
      }
    }
  }
}

run().catch(console.error);
