export function chunkText(text: string, size = 900, overlap = 120) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = start + size;
    if (end < normalized.length) {
      const lastSpace = normalized.lastIndexOf(' ', end);
      end = lastSpace > start + size * 0.5 ? lastSpace : end;
    }

    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(start + size - overlap, end - overlap);
  }

  return chunks;
}
