import type { Request, Response } from 'express';

import { DocumentService } from '../services/document.service.js';

export class DocumentController {
  constructor(private readonly service = new DocumentService()) {}

  list = async (req: Request, res: Response) => {
    const user = (req as Request & { user?: { id: string; email: string; name?: string | null } }).user;
    const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;

    if (!user?.id || !workspaceId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Workspace context is required' } });
      return;
    }

    const documents = await this.service.listForWorkspace(user.id, workspaceId);
    res.json({ success: true, data: { documents } });
  };

  upload = async (req: Request, res: Response) => {
    const user = (req as Request & { user?: { id: string; email: string; name?: string | null } }).user;
    const workspaceId = (req as Request & { workspaceId?: string }).workspaceId;

    if (!user?.id || !workspaceId || !req.file) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'File upload is required' } });
      return;
    }

    try {
      const result = await this.service.createFromUpload(user.id, workspaceId, req.file);
      res.status(result.duplicate ? 200 : 201).json({ success: true, data: { result } });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: error instanceof Error ? error.message : 'Upload failed' },
      });
    }
  };
}
