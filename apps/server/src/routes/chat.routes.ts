import { Router } from 'express';
import type { ChatMessage } from '@prisma/client';

import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireWorkspaceAccess } from '../middleware/workspace.middleware.js';
import { ChatService } from '../services/chat.service.js';
import { createLogger } from '../lib/logger.js';

const router = Router({ mergeParams: true });
const chatService = new ChatService();
const logger = createLogger('chat-routes');

router.use(requireAuth, requireWorkspaceAccess);

router.get('/sessions', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const sessions = await chatService.listSessions(user!.id, workspaceId!);
  res.json({ success: true, data: { sessions } });
});

router.post('/sessions', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const session = await chatService.createSession(user!.id, workspaceId!, req.body?.title);
  res.status(201).json({ success: true, data: { session } });
});

router.get('/sessions/:sessionId/messages', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const messages = await chatService.getHistory(user!.id, workspaceId!, req.params.sessionId);
  res.json({ success: true, data: { messages } });
});

router.post('/sessions/:sessionId/messages', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const content = String(req.body?.content ?? '').trim();

  if (!content) {
    res
      .status(400)
      .json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Message content is required' },
      });
    return;
  }

  try {
    await chatService.addMessage({
      sessionId: req.params.sessionId,
      workspaceId: workspaceId!,
      userId: user!.id,
      role: 'user',
      content,
    });

    // Load conversation history for context
    const history = await chatService.getHistory(user!.id, workspaceId!, req.params.sessionId);
    const messages = history.map((m: ChatMessage) => ({ role: m.role, content: m.content }));

    const reply = await chatService.generateReply(workspaceId!, user!.id, messages);

    const assistantMessage = await chatService.addMessage({
      sessionId: req.params.sessionId,
      workspaceId: workspaceId!,
      userId: user!.id,
      role: 'assistant',
      content: reply.content,
      citations: reply.citations,
      toolEvents: reply.toolEvents,
    });

    res.json({
      success: true,
      data: { message: assistantMessage, citations: reply.citations, toolEvents: reply.toolEvents },
    });
  } catch (error) {
    logger.error({ error, workspaceId, sessionId: req.params.sessionId }, 'Chat message failed');
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAT_FAILED',
        message: error instanceof Error ? error.message : 'Chat failed',
      },
    });
  }
});

/**
 * SSE streaming endpoint — streams Gemini tokens in real-time.
 * Events: citations | token | tool_event | done | error
 */
router.post('/sessions/:sessionId/stream', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const content = String(req.body?.content ?? '').trim();

  if (!content) {
    res
      .status(400)
      .json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Message content is required' },
      });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let fullContent = '';
  const allToolEvents: unknown[] = [];
  let citations: unknown[] = [];

  try {
    // Save user message first
    await chatService.addMessage({
      sessionId: req.params.sessionId,
      workspaceId: workspaceId!,
      userId: user!.id,
      role: 'user',
      content,
    });

    const history = await chatService.getHistory(user!.id, workspaceId!, req.params.sessionId);
    const messages = history.map((m: ChatMessage) => ({ role: m.role, content: m.content }));

    for await (const event of chatService.streamReplyTokens(workspaceId!, user!.id, messages)) {
      if (event.type === 'citations') {
        citations = event.data as unknown[];
        sendEvent('citations', event.data);
      } else if (event.type === 'token') {
        fullContent += event.data as string;
        sendEvent('token', { text: event.data });
      } else if (event.type === 'tool_event') {
        allToolEvents.push(event.data);
        sendEvent('tool_event', event.data);
      } else if (event.type === 'done') {
        sendEvent('done', {});
      }
    }

    // Persist assistant message after streaming completes
    await chatService.addMessage({
      sessionId: req.params.sessionId,
      workspaceId: workspaceId!,
      userId: user!.id,
      role: 'assistant',
      content: fullContent || "I don't know based on the documents in this workspace.",
      citations,
      toolEvents: allToolEvents,
    });
  } catch (error) {
    logger.error({ error, workspaceId, sessionId: req.params.sessionId }, 'SSE stream failed');
    sendEvent('error', { message: error instanceof Error ? error.message : 'Stream failed' });
  } finally {
    res.end();
  }
});

export default router;
