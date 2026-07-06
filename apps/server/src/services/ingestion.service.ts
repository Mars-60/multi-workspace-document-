import { createHash } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { uploadToStorage } from '../lib/storage.js';
import { embedText } from '../lib/embeddings.js';
import { chunkText } from '../lib/chunking.js';

const logger = createLogger('ingestion-service');

const EMBEDDING_BATCH_SIZE = 5; // max concurrent embedding calls
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

async function withRetry<T>(operation: () => Promise<T>, attempts = 3, delayMs = 250): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

async function batchEmbeddings(chunks: string[]): Promise<number[][]> {
  const results: number[][] = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((chunk) => withRetry(() => embedText(chunk))));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }

  return results;
}

export class IngestionService {
  async ingestDocument(input: {
    workspaceId: string;
    ownerId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large: max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`);
    }

    const contentHash = createHash('sha256').update(input.buffer).digest('hex');
    const existing = await prisma.document.findFirst({
      where: { workspaceId: input.workspaceId, contentHash },
    });

    if (existing) {
      logger.info(
        { workspaceId: input.workspaceId, documentId: existing.id },
        'Duplicate document detected',
      );
      return { duplicate: true, document: existing };
    }

    const storagePath = `${input.workspaceId}/${contentHash}-${input.filename}`;
    await withRetry(() => uploadToStorage(storagePath, input.buffer, input.mimeType));

    const text = await this.extractText(input.filename, input.mimeType, input.buffer);

    if (!text.trim()) {
      throw new Error('Document produced no extractable text');
    }

    const chunks = chunkText(text);
    logger.info(
      { workspaceId: input.workspaceId, filename: input.filename, chunks: chunks.length },
      'Starting embedding generation',
    );
    let embeddings: number[][];

    try {
      embeddings = await batchEmbeddings(chunks);
    } catch (error) {
      logger.error(
        {
          workspaceId: input.workspaceId,
          error: error instanceof Error ? error.message : error,
        },
        'Embedding generation failed. Falling back to zero vectors.',
      );

      // Must match the output dimension of the embedding model (768 for
      // gemini-embedding-001 with outputDimensionality:768). Zero vectors
      // will rank poorly but at least won't cause a pgvector dimension mismatch.
      embeddings = chunks.map(() => new Array(768).fill(0));
    }

    const document = await prisma.document.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: input.ownerId,
        filename: input.filename,
        mimeType: input.mimeType,
        storagePath,
        contentHash,
        status: 'READY',
        textLength: text.length,
      },
    });

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const [index, chunk] of chunks.entries()) {
        const chunkId = `${document.id}-${index}`;
        await tx.$executeRawUnsafe(
          `INSERT INTO "document_chunks" ("id", "documentId", "workspaceId", "content", "chunkIndex", "embedding")
           VALUES ($1, $2, $3, $4, $5, $6::vector)`,
          chunkId,
          document.id,
          input.workspaceId,
          chunk,
          index,
          JSON.stringify(embeddings[index]),
        );
      }
    });

    logger.info(
      { workspaceId: input.workspaceId, documentId: document.id, chunks: chunks.length },
      'Document ingested successfully',
    );

    return { duplicate: false, document };
  }

  private async extractText(filename: string, mimeType: string, buffer: Buffer): Promise<string> {
    if (mimeType === 'application/pdf') {
      try {
        const pdf = new PDFParse({ data: buffer });
        const parsed = await pdf.getText();
        return parsed.text;
      } catch (error) {
        logger.error(
          { filename, error: error instanceof Error ? error.message : error },
          'PDF parse failed',
        );
        throw new Error(
          `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }

    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return buffer.toString('utf8');
    }

    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}
