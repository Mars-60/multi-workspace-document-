import { GoogleGenAI } from '@google/genai';

import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import env from '../config/env.js';
import { buildSystemPrompt, buildToolSchema } from '../prompts/system.js';
import { executeTool } from '../tools/registry.js';

import { RAGService, type RetrievedChunk } from './rag.service.js';

const logger = createLogger('chat-service');

type ChatRole = 'user' | 'assistant' | 'tool';

const MIN_RELEVANCE_SCORE = 0.05;
const MAX_TOOL_ITERATIONS = 5;

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) return null;

  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
  });
}
export class ChatService {
  constructor(private readonly ragService = new RAGService()) {}

  async createSession(userId: string, workspaceId: string, title?: string) {
    return prisma.chatSession.create({
      data: {
        userId,
        workspaceId,
        title: title?.slice(0, 120) || 'New chat',
      },
    });
  }

  async addMessage(input: {
    sessionId: string;
    workspaceId: string;
    userId: string;
    role: ChatRole;
    content: string;
    citations?: unknown;
    toolEvents?: unknown;
  }) {
    await this.ensureSession(input.userId, input.workspaceId, input.sessionId);
    return prisma.chatMessage.create({
      data: {
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        role: input.role,
        content: input.content,
        citations:
          input.citations === undefined ? undefined : JSON.parse(JSON.stringify(input.citations)),
        toolEvents:
          input.toolEvents === undefined ? undefined : JSON.parse(JSON.stringify(input.toolEvents)),
      },
    });
  }

  /**
   * Generate a grounded reply using Gemini with function calling and RAG context.
   * Supports multi-step tool execution up to MAX_TOOL_ITERATIONS.
   */
  async generateReply(
    workspaceId: string,
    userId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<{ content: string; citations: unknown[]; toolEvents: unknown[] }> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const startMs = Date.now();

    // Prompt injection check
    if (this.ragService.containsPromptInjection(lastUserMessage)) {
      logger.warn({ workspaceId }, 'Prompt injection attempt blocked');
      return {
        content:
          "I don't know. The request appears to ask me to ignore instructions or reveal protected context.",
        citations: [],
        toolEvents: [],
      };
    }

    // Retrieve grounding context
    const chunks = await this.ragService.retrieve(workspaceId, lastUserMessage);
    const citations = chunks.map((chunk) => ({
      documentId: chunk.documentId,
      source: chunk.source,
      citation: chunk.citation,
      score: chunk.score,
    }));

    const client = getGeminiClient();

    // No Gemini key: fallback to context-only response (non-production)
    if (!client) {
      if (env.NODE_ENV === 'production') {
        throw new Error('Gemini API key is required in production');
      }

      if (!chunks.length || (chunks[0]?.score ?? 0) < MIN_RELEVANCE_SCORE) {
        return {
          content: "I don't know based on the documents in this workspace.",
          citations: [],
          toolEvents: [],
        };
      }

      const context = chunks.map((c, i) => `[${i + 1}] ${c.citation}\n${c.content}`).join('\n\n');
      return {
        content: `Based on the workspace documents:\n\n${context}`,
        citations,
        toolEvents: [],
      };
    }

    const systemPrompt = buildSystemPrompt(chunks);
    const toolSchemas = buildToolSchema();
    const toolEvents: unknown[] = [];

    // Build conversation history for Gemini
    const history = messages
      .slice(0, -1) // exclude last user message
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        parts: [{ text: m.content }],
      }));

    const chat = client.chats.create({
      model: env.GEMINI_CHAT_MODEL,
      history,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolSchemas }],
      },
    });

    let responseText = '';
    let iterationCount = 0;
    let currentMessage:
      string | Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> =
      lastUserMessage;

    // Multi-step tool execution loop
    while (iterationCount < MAX_TOOL_ITERATIONS) {
      iterationCount += 1;

      const result = await chat.sendMessage({ message: currentMessage });
      const functionCalls = result.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const functionResults: Array<{
          functionResponse: { name: string; response: Record<string, unknown> };
        }> = [];

        for (const call of functionCalls) {
          const toolName = call.name;
          if (!toolName) {
            continue;
          }
          const toolInput = (call.args || {}) as Record<string, unknown>;

          logger.info({ workspaceId, toolName, toolInput }, 'Gemini function call');

          try {
            const output = await executeTool(toolName, toolInput, { userId, workspaceId });
            toolEvents.push({ tool: toolName, input: toolInput, output, status: 'success' });
            functionResults.push({
              functionResponse: { name: toolName, response: { output } },
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
            toolEvents.push({
              tool: toolName,
              input: toolInput,
              error: errorMessage,
              status: 'error',
            });
            functionResults.push({
              functionResponse: { name: toolName, response: { error: errorMessage } },
            });
          }
        }

        // Feed tool results back to Gemini
        currentMessage = functionResults.map((r) => ({
          functionResponse: r.functionResponse,
        }));
      } else {
        // No more function calls — extract text response
        responseText = result.text ?? '';
        break;
      }
    }

    if (!responseText.trim()) {
      responseText = "I don't know based on the documents in this workspace.";
    }

    const latencyMs = Date.now() - startMs;
    const usageMetadata =
      chunks.length > 0 ? { retrievedChunks: chunks.length, latencyMs } : { latencyMs };
    logger.info(
      { workspaceId, latencyMs, retrievedChunks: chunks.length, toolCallCount: toolEvents.length },
      'chat reply generated',
    );

    void usageMetadata;

    return { content: responseText, citations, toolEvents };
  }

  /**
   * Stream Gemini response tokens via an async generator for SSE.
   */
  async *streamReplyTokens(
    workspaceId: string,
    userId: string,
    messages: Array<{ role: string; content: string }>,
  ): AsyncGenerator<{ type: 'token' | 'citations' | 'tool_event' | 'done'; data: unknown }> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    if (this.ragService.containsPromptInjection(lastUserMessage)) {
      yield {
        type: 'token',
        data: "I don't know. The request appears to ask me to ignore instructions or reveal protected context.",
      };
      yield { type: 'done', data: {} };
      return;
    }

    const chunks = await this.ragService.retrieve(workspaceId, lastUserMessage);
    const citations = chunks.map((chunk: RetrievedChunk) => ({
      documentId: chunk.documentId,
      source: chunk.source,
      citation: chunk.citation,
      score: chunk.score,
    }));

    yield { type: 'citations', data: citations };

    const client = getGeminiClient();

    if (!client) {
      if (!chunks.length || (chunks[0]?.score ?? 0) < MIN_RELEVANCE_SCORE) {
        yield { type: 'token', data: "I don't know based on the documents in this workspace." };
        yield { type: 'done', data: {} };
        return;
      }
      const context = chunks
        .map((c: RetrievedChunk, i: number) => `[${i + 1}] ${c.citation}\n${c.content}`)
        .join('\n\n');
      yield { type: 'token', data: `Based on the workspace documents:\n\n${context}` };
      yield { type: 'done', data: {} };
      return;
    }

    const systemPrompt = buildSystemPrompt(chunks);
    const toolSchemas = buildToolSchema();

    const chat = client.chats.create({
      model: env.GEMINI_CHAT_MODEL,
      history: messages
        .slice(0, -1)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
          parts: [{ text: m.content }],
        })),
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolSchemas }],
      },
    });

    const streamResult = await chat.sendMessageStream({ message: lastUserMessage });

    let fullText = '';
    for await (const chunk of streamResult) {
      const tokenText = chunk.text;
      if (tokenText) {
        fullText += tokenText;
        yield { type: 'token', data: tokenText };
      }

      // Check for function calls in streamed chunks
      const functionCalls = chunk.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          const toolName = call.name;
          if (!toolName) {
            continue;
          }
          const toolInput = (call.args || {}) as Record<string, unknown>;
          try {
            const output = await executeTool(toolName, toolInput, { userId, workspaceId });
            yield { type: 'tool_event', data: { tool: toolName, output, status: 'success' } };
          } catch (error) {
            yield {
              type: 'tool_event',
              data: {
                tool: toolName,
                error: error instanceof Error ? error.message : 'failed',
                status: 'error',
              },
            };
          }
        }
      }
    }

    if (!fullText.trim()) {
      yield { type: 'token', data: "I don't know based on the documents in this workspace." };
    }

    yield { type: 'done', data: {} };
  }

  async getHistory(userId: string, workspaceId: string, sessionId: string) {
    await this.ensureSession(userId, workspaceId, sessionId);
    return prisma.chatMessage.findMany({
      where: { workspaceId, sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async retrieveContext(workspaceId: string, query: string) {
    return this.ragService.retrieve(workspaceId, query);
  }

  async listSessions(userId: string, workspaceId: string) {
    return prisma.chatSession.findMany({
      where: { workspaceId, userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async ensureSession(userId: string, workspaceId: string, sessionId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, workspaceId, userId },
    });

    if (!session) {
      throw new Error('Chat session not found');
    }

    return session;
  }
}
