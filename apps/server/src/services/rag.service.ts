import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { embedText } from '../lib/embeddings.js';

const logger = createLogger('rag-service');

export type RetrievedChunk = {
  id: string;
  content: string;
  documentId: string;
  similarity: number;
  keywordRank: number;
  rrfScore: number;
  score: number;
  source: string;
  citation: string;
};

type RawVectorChunk = {
  id: string;
  content: string;
  documentId: string;
  similarity: number;
  source: string;
  citation: string;
};

type RawKeywordChunk = {
  id: string;
  content: string;
  documentId: string;
  keywordRank: number;
  source: string;
  citation: string;
};

const injectionPatterns = [
  /ignore (all )?(previous|above) instructions/i,
  /system prompt/i,
  /developer message/i,
  /reveal (the )?(prompt|secrets?)/i,
  /act as (a |an )?(different|unrestricted|jailbroken)/i,
  /pretend (you are|to be) (an? )?(different|unrestricted)/i,
  /disregard (all|any|previous) (instructions|constraints)/i,
];

const TOP_K = 8;
const RRF_K = 60; // standard RRF constant

export class RAGService {
  containsPromptInjection(text: string) {
    return injectionPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Hybrid retrieval: vector similarity + full-text search fused with Reciprocal Rank Fusion.
   * Results are strictly workspace-scoped in SQL to prevent cross-workspace leakage.
   */
  async retrieve(workspaceId: string, query: string): Promise<RetrievedChunk[]> {
    if (this.containsPromptInjection(query)) {
      logger.warn({ workspaceId }, 'Prompt injection detected in retrieval query');
      return [];
    }

    const startMs = Date.now();

    const embedding = await embedText(query);

    // Vector similarity search (workspace-scoped)
    const vectorChunks = await prisma.$queryRawUnsafe<RawVectorChunk[]>(
      `SELECT
         dc."id",
         dc."content",
         dc."documentId",
         1 - (dc."embedding" <=> $1::vector) AS similarity,
         d."filename" AS source,
         d."filename" || ' #' || dc."chunkIndex" AS citation
       FROM "document_chunks" dc
       JOIN "documents" d ON d."id" = dc."documentId" AND d."workspaceId" = $2
       WHERE dc."workspaceId" = $2
         AND dc."embedding" IS NOT NULL
       ORDER BY dc."embedding" <=> $1::vector
       LIMIT $3`,
      JSON.stringify(embedding),
      workspaceId,
      TOP_K,
    );

    // Full-text search (workspace-scoped)
    const keywordChunks = await prisma.$queryRawUnsafe<RawKeywordChunk[]>(
      `SELECT
         dc."id",
         dc."content",
         dc."documentId",
         ts_rank_cd(dc."tsv", plainto_tsquery('english', $1)) AS "keywordRank",
         d."filename" AS source,
         d."filename" || ' #' || dc."chunkIndex" AS citation
       FROM "document_chunks" dc
       JOIN "documents" d ON d."id" = dc."documentId" AND d."workspaceId" = $2
       WHERE dc."workspaceId" = $2
         AND dc."tsv" @@ plainto_tsquery('english', $1)
       ORDER BY "keywordRank" DESC
       LIMIT $3`,
      query,
      workspaceId,
      TOP_K,
    );

    // Reciprocal Rank Fusion
    const scores = new Map<string, { rrfScore: number; vectorRank?: number; keywordRank?: number; chunk: RawVectorChunk | RawKeywordChunk }>();

    for (const [rank, chunk] of vectorChunks.entries()) {
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = scores.get(chunk.id);
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.vectorRank = rank;
      } else {
        scores.set(chunk.id, { rrfScore, vectorRank: rank, chunk });
      }
    }

    for (const [rank, chunk] of keywordChunks.entries()) {
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = scores.get(chunk.id);
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.keywordRank = rank;
      } else {
        scores.set(chunk.id, { rrfScore, keywordRank: rank, chunk });
      }
    }

    const merged: RetrievedChunk[] = Array.from(scores.entries())
      .sort(([, a], [, b]) => b.rrfScore - a.rrfScore)
      .slice(0, 5)
      .map(([id, entry]) => {
        const vectorEntry = vectorChunks.find((c) => c.id === id);
        const keywordEntry = keywordChunks.find((c) => c.id === id);
        return {
          id,
          content: entry.chunk.content,
          documentId: entry.chunk.documentId,
          similarity: vectorEntry?.similarity ?? 0,
          keywordRank: typeof (keywordEntry as RawKeywordChunk | undefined)?.keywordRank === 'number'
            ? (keywordEntry as RawKeywordChunk).keywordRank
            : 0,
          rrfScore: entry.rrfScore,
          score: entry.rrfScore, // unified score for downstream consumers
          source: entry.chunk.source,
          citation: entry.chunk.citation,
        };
      });

    const latencyMs = Date.now() - startMs;
    logger.info({ workspaceId, retrieved: merged.length, vectorResults: vectorChunks.length, keywordResults: keywordChunks.length, latencyMs }, 'retrieval complete');

    return merged;
  }
}
