import { z } from 'zod';
import type { DocumentChunk } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export type ToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute: (input: unknown, context: { userId: string; workspaceId: string }) => Promise<unknown>;
};

const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  toolRegistry.set(tool.name, tool);
}

export function getTool(name: string) {
  return toolRegistry.get(name);
}

export function listTools() {
  return Array.from(toolRegistry.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));
}

export async function executeTool(
  name: string,
  input: unknown,
  context: { userId: string; workspaceId: string },
) {
  const tool = getTool(name);
  if (!tool) {
    await prisma.toolLog.create({
      data: {
        workspaceId: context.workspaceId,
        userId: context.userId,
        toolName: name,
        input: JSON.parse(JSON.stringify(input ?? {})),
        status: 'FAILED',
        error: 'Unknown tool',
      },
    });
    throw new Error('Unknown tool');
  }

  try {
    const parsed = tool.schema.parse(input);
    const output = await tool.execute(parsed, context);
    await prisma.toolLog.create({
      data: {
        workspaceId: context.workspaceId,
        userId: context.userId,
        toolName: name,
        input: JSON.parse(JSON.stringify(parsed)),
        output: JSON.parse(JSON.stringify(output ?? {})),
        status: 'SUCCESS',
      },
    });
    return output;
  } catch (error) {
    await prisma.toolLog.create({
      data: {
        workspaceId: context.workspaceId,
        userId: context.userId,
        toolName: name,
        input: JSON.parse(JSON.stringify(input ?? {})),
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Tool execution failed',
      },
    });
    throw error;
  }
}

registerTool({
  name: 'save_task',
  description: 'Persist a task in the workspace audit log.',
  schema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  }),
  execute: async (input, context) => {
    const payload = input as { title: string; description?: string };
    const task = await prisma.task.create({
      data: {
        workspaceId: context.workspaceId,
        createdBy: context.userId,
        title: payload.title,
        description: payload.description,
      },
    });
    return { saved: true, task };
  },
});

registerTool({
  name: 'create_note',
  description: 'Create a workspace note as an open task.',
  schema: z.object({ title: z.string(), body: z.string() }),
  execute: async (input, context) => {
    const payload = input as { title: string; body: string };
    const task = await prisma.task.create({
      data: {
        workspaceId: context.workspaceId,
        createdBy: context.userId,
        title: payload.title,
        description: payload.body,
      },
    });
    return { created: true, note: task };
  },
});

registerTool({
  name: 'summarize_document',
  description: 'Summarize a selected document.',
  schema: z.object({ documentId: z.string() }),
  execute: async (input, context) => {
    const payload = input as { documentId: string };
    const document = await prisma.document.findFirst({
      where: { id: payload.documentId, workspaceId: context.workspaceId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 5 } },
    });
    if (!document) {
      throw new Error('Document not found');
    }
    const summary = document.chunks
      .map((chunk: DocumentChunk) => chunk.content)
      .join(' ')
      .slice(0, 1200);
    return { summarized: true, documentId: document.id, summary };
  },
});

registerTool({
  name: 'send_discord_summary',
  description: 'Send a summary to a Discord webhook.',
  schema: z.object({ content: z.string().min(1).max(1800) }),
  execute: async (input) => ({ sent: false, queued: true, payload: input }),
});
