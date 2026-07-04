const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetch(url);
  const json = await response.json();
  if (json.models) {
    console.log("Available models:");
    json.models.forEach(m => {
      console.log(`- Name: ${m.name}, Methods: ${m.supportedGenerationMethods.join(', ')}`);
    });
  } else {
    console.error("Failed to retrieve models:", json);
  }
}

run().catch(console.error);
