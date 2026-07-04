import { prisma } from '../lib/prisma.js';

export class DocumentRepository {
  async findByWorkspace(workspaceId: string) {
    return prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByHash(workspaceId: string, contentHash: string) {
    return prisma.document.findFirst({ where: { workspaceId, contentHash } });
  }

  async create(input: {
    workspaceId: string;
    ownerId: string;
    filename: string;
    mimeType: string;
    storagePath: string;
    contentHash: string;
    status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
    textLength?: number;
  }) {
    return prisma.document.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: input.ownerId,
        filename: input.filename,
        mimeType: input.mimeType,
        storagePath: input.storagePath,
        contentHash: input.contentHash,
        status: input.status,
        textLength: input.textLength ?? 0,
      },
    });
  }

  async updateStatus(id: string, status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED', textLength?: number) {
    return prisma.document.update({
      where: { id },
      data: {
        status,
        textLength: textLength ?? undefined,
      },
    });
  }
}
