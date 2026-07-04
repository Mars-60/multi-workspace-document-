import { Router } from 'express';

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireWorkspaceAccess } from '../middleware/workspace.middleware.js';
import { RAGService } from '../services/rag.service.js';

const router = Router({ mergeParams: true });
const ragService = new RAGService();

router.use(requireAuth, requireWorkspaceAccess);

router.post('/debug', async (req, res) => {
  const workspaceId = (req as typeof req & { workspaceId?: string }).workspaceId;
  const query = String(req.body?.query ?? '').trim();
  if (!query) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Query is required' } });
    return;
  }

  const chunks = await ragService.retrieve(workspaceId!, query);
  res.json({ success: true, data: { chunks, injectionBlocked: chunks.length === 0 && ragService.containsPromptInjection(query) } });
});

export default router;
