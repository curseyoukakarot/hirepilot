export const WORKSPACES_ENFORCE_STRICT =
  String(process.env.WORKSPACES_ENFORCE_STRICT || 'false').toLowerCase() === 'true';

type WorkspaceScopeArgs = {
  workspaceId?: string | null;
  userId?: string | null;
  ownerColumn?: string;
};

export function applyWorkspaceScope<T = any>(
  query: T,
  { workspaceId, userId, ownerColumn = 'user_id' }: WorkspaceScopeArgs
): T {
  if (!workspaceId) return query;
  if (WORKSPACES_ENFORCE_STRICT) {
    return (query as any).eq('workspace_id', workspaceId);
  }
  if (!userId) return (query as any).eq('workspace_id', workspaceId);
  return (query as any).or(
    `workspace_id.eq.${workspaceId},and(workspace_id.is.null,${ownerColumn}.eq.${userId})`
  );
}
