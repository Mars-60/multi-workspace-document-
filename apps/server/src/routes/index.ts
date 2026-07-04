import { Router } from 'express';

import authRoutes from './auth.routes.js';
import chatRoutes from './chat.routes.js';
import documentRoutes from './document.routes.js';
import retrievalRoutes from './retrieval.routes.js';
import taskRoutes from './task.routes.js';
import toolRoutes from './tool.routes.js';
import workspaceRoutes from './workspace.routes.js';

export function createAppRouter() {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'api' });
  });

  router.use('/auth', authRoutes);
  router.use('/workspaces', workspaceRoutes);
  router.use('/workspaces/:workspaceId/documents', documentRoutes);
  router.use('/workspaces/:workspaceId/chat', chatRoutes);
  router.use('/workspaces/:workspaceId/retrieval', retrievalRoutes);
  router.use('/workspaces/:workspaceId/tasks', taskRoutes);
  router.use('/workspaces/:workspaceId/tools', toolRoutes);

  return router;
}
