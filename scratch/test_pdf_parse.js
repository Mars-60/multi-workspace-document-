import { readFileSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';

try {
  const buffer = readFileSync('Multi-Workspace Document Assistant (RAG & Tool Calling)-2026070314355699.pdf');
  console.log("PDF file size:", buffer.length);
  const pdf = new PDFParse({ data: buffer });
  console.log("PDFParse instantiated successfully");
  const parsed = await pdf.getText();
  console.log("getText() called successfully");
  console.log("Extracted text preview:", parsed.text.slice(0, 500));
} catch (e) {
  console.error("Error with new PDFParse:", e);
}
