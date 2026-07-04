import type { Request, Response, NextFunction } from 'express';

import { WorkspaceService } from '../services/workspace.service.js';

const workspaceService = new WorkspaceService();

export async function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction) {
  const workspaceId = req.params.workspaceId || req.query.workspaceId;
  const user = (req as Request & { user?: { id: string; email: string; name?: string | null } }).user;

  if (!workspaceId || !user?.id) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Workspace context is required' } });
    return;
  }

  try {
    await workspaceService.ensureMembership(user.id, String(workspaceId));
    (req as Request & { workspaceId?: string }).workspaceId = String(workspaceId);
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace access denied';
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message } });
  }
}
