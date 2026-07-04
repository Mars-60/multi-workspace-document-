import * as pdfParseModule from 'pdf-parse';
console.log("pdf-parse exports:", Object.keys(pdfParseModule));
console.log("Default export type:", typeof pdfParseModule.default);

try {
  const pdfParse = pdfParseModule.default || pdfParseModule;
  console.log("Attempting to parse a dummy buffer using default export function...");
  // Pass a minimal valid PDF or just run the function to see if it's a function
  console.log("Function type:", typeof pdfParse);
} catch (e) {
  console.error("Error testing pdf-parse:", e);
}
