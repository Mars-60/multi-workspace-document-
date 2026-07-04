import type { Request, Response } from 'express';

import { WorkspaceService } from '../services/workspace.service.js';

export class WorkspaceController {
  constructor(private readonly service = new WorkspaceService()) {}

  list = async (req: Request, res: Response) => {
    const user = (req as Request & { user?: { id: string; email: string; name?: string | null } }).user;
    if (!user?.id) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const workspaces = await this.service.listForUser(user.id);
    res.json({ success: true, data: { workspaces } });
  };

  create = async (req: Request, res: Response) => {
    const user = (req as Request & { user?: { id: string; email: string; name?: string | null } }).user;
    if (!user?.id) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    try {
      const workspace = await this.service.createForUser(user.id, req.body.name);
      res.status(201).json({ success: true, data: { workspace } });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: error instanceof Error ? error.message : 'Workspace creation failed' },
      });
    }
  };
}
