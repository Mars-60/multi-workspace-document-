import { WorkspaceRepository } from '../repositories/workspace.repository.js';

export class WorkspaceService {
  constructor(private readonly repository = new WorkspaceRepository()) {}

  async listForUser(userId: string) {
    const memberships = await this.repository.findUserWorkspaces(userId);
    return memberships.flatMap((membership) => {
      if (!membership.workspace) {
        return [];
      }

      return [
        {
          id: membership.workspace.id,
          name: membership.workspace.name,
          slug: membership.workspace.slug,
          role: membership.role,
          createdAt: membership.workspace.createdAt,
        },
      ];
    });
  }

  async createForUser(userId: string, name: string) {
    const safeName = name?.trim();
    if (!safeName) {
      throw new Error('Workspace name is required');
    }

    const baseSlug = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
    let slug = baseSlug;
    let suffix = 1;
    while (await this.repository.findBySlug(slug)) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const workspace = await this.repository.createWorkspace(userId, safeName, slug);

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: 'OWNER' as const,
      createdAt: workspace.createdAt,
    };
  }

  async ensureMembership(userId: string, workspaceId: string) {
    const membership = await this.repository.membership(userId, workspaceId);
    if (!membership) {
      throw new Error('Workspace access denied');
    }
    return membership;
  }
}
