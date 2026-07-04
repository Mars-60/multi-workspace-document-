import { DocumentRepository } from '../repositories/document.repository.js';

import { IngestionService } from './ingestion.service.js';
import { WorkspaceService } from './workspace.service.js';

const allowedMimeTypes = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']);

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export class DocumentService {
  constructor(
    private readonly repository = new DocumentRepository(),
    private readonly workspaceService = new WorkspaceService(),
    private readonly ingestionService = new IngestionService(),
  ) {}

  async listForWorkspace(userId: string, workspaceId: string) {
    await this.workspaceService.ensureMembership(userId, workspaceId);
    return this.repository.findByWorkspace(workspaceId);
  }

  async createFromUpload(userId: string, workspaceId: string, file: UploadedFile) {
    await this.workspaceService.ensureMembership(userId, workspaceId);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new Error('Unsupported file type');
    }

    return this.ingestionService.ingestDocument({
      workspaceId,
      ownerId: userId,
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }
}
