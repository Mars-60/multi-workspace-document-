import type { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export class WorkspaceRepository {
  async findUserWorkspaces(userId: string) {
    return prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
      orderBy: { workspace: { createdAt: 'asc' } },
    });
  }

  async createWorkspace(userId: string, name: string, slug: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const workspace = await tx.workspace.create({
        data: {
          name,
          slug,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER',
        },
      });

      return workspace;
    });
  }

  async findWorkspaceById(workspaceId: string) {
    return prisma.workspace.findUnique({ where: { id: workspaceId } });
  }

  async findBySlug(slug: string) {
    return prisma.workspace.findUnique({ where: { slug } });
  }

  async membership(userId: string, workspaceId: string) {
    return prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }
}
