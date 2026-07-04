import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireWorkspaceAccess } from '../middleware/workspace.middleware.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireWorkspaceAccess);

router.get('/', async (req, res) => {
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const tasks = await prisma.task.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: { tasks } });
});

export default router;
