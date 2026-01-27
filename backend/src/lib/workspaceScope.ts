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
  if (!workspaceId || !query) return query;
  const applyScope = (builder: any) => {
    if (!builder || typeof builder.eq !== 'function') return builder;
    if (WORKSPACES_ENFORCE_STRICT) {
      return builder.eq('workspace_id', workspaceId);
    }
    if (!userId) return builder.eq('workspace_id', workspaceId);
    return builder.or(
      `workspace_id.eq.${workspaceId},and(workspace_id.is.null,${ownerColumn}.eq.${userId})`
    );
  };

  // If the builder already supports filters, apply immediately.
  if (typeof (query as any).eq === 'function') {
    return applyScope(query) as T;
  }

  // If this is a query builder (select/update/delete), wrap it so the scope
  // applies once a filter-capable builder is returned.
  const methodsToWrap = new Set(['select', 'update', 'delete', 'upsert']);
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      const value = target?.[prop];
      if (typeof value !== 'function') return value;
      const name = String(prop);
      if (!methodsToWrap.has(name)) return value.bind(target);
      return (...args: any[]) => applyScope(value.apply(target, args));
    }
  };
  return new Proxy(query as any, handler) as T;
}
