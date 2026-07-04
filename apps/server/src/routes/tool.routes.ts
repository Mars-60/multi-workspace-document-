import { Router } from 'express';
import { ZodError } from 'zod';

import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireWorkspaceAccess } from '../middleware/workspace.middleware.js';
import { executeTool, listTools } from '../tools/registry.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireWorkspaceAccess);

router.get('/', (_req, res) => {
  res.json({ success: true, data: { tools: listTools() } });
});

router.get('/logs/list', async (req, res) => {
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const logs = await prisma.toolLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: { logs } });
});

router.post('/:toolName', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;

  try {
    const output = await executeTool(req.params.toolName, req.body ?? {}, {
      userId: user!.id,
      workspaceId: workspaceId!,
    });
    res.json({ success: true, data: { output } });
  } catch (error) {
    const isValidation = error instanceof ZodError;
    res.status(isValidation ? 400 : 404).json({
      success: false,
      error: {
        code: isValidation ? 'VALIDATION_ERROR' : 'TOOL_FAILED',
        message: error instanceof Error ? error.message : 'Tool failed',
      },
    });
  }
});

export default router;
