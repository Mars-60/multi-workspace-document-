type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

type WorkspaceMembershipRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

type DocumentRecord = {
  id: string;
  workspaceId: string;
  ownerId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  contentHash: string;
  status: string;
  textLength: number;
  createdAt: Date;
  updatedAt: Date;
};

const workspaces = new Map<string, WorkspaceRecord>();
const memberships = new Map<string, WorkspaceMembershipRecord>();
const documents = new Map<string, DocumentRecord>();

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function resetInMemoryState() {
  workspaces.clear();
  memberships.clear();
  documents.clear();
}

export function findUserWorkspacesInMemory(userId: string) {
  const membershipsForUser = Array.from(memberships.values()).filter((membership) => membership.userId === userId);
  return membershipsForUser
    .map((membership) => ({
      ...membership,
      workspace: workspaces.get(membership.workspaceId),
    }))
    .filter((membership) => membership.workspace);
}

export function createWorkspaceInMemory(userId: string, name: string, slug: string) {
  const now = new Date();
  const workspace: WorkspaceRecord = {
    id: createId('workspace'),
    name,
    slug,
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
  };

  workspaces.set(workspace.id, workspace);
  memberships.set(createId('membership'), {
    id: createId('membership'),
    workspaceId: workspace.id,
    userId,
    role: 'OWNER',
    createdAt: now,
  });

  return workspace;
}

export function findWorkspaceByIdInMemory(workspaceId: string) {
  return workspaces.get(workspaceId);
}

export function membershipInMemory(userId: string, workspaceId: string) {
  return Array.from(memberships.values()).find((membership) => membership.userId === userId && membership.workspaceId === workspaceId);
}

export function listDocumentsInMemory(workspaceId: string) {
  return Array.from(documents.values())
    .filter((document) => document.workspaceId === workspaceId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function findDocumentByHashInMemory(workspaceId: string, contentHash: string) {
  return Array.from(documents.values()).find((document) => document.workspaceId === workspaceId && document.contentHash === contentHash);
}

export function createDocumentInMemory(input: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const now = new Date();
  const document: DocumentRecord = {
    id: createId('document'),
    createdAt: now,
    updatedAt: now,
    ...input,
  };

  documents.set(document.id, document);
  return document;
}

export function updateDocumentStatusInMemory(id: string, status: string, textLength?: number) {
  const document = documents.get(id);
  if (!document) {
    return null;
  }

  const updated = {
    ...document,
    status,
    textLength: textLength ?? document.textLength,
    updatedAt: new Date(),
  };

  documents.set(id, updated);
  return updated;
}
