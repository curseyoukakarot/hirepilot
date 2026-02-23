import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { supabase } from '../lib/supabase';
import { attachApiKeyAuth } from '../middleware/withApiKeyAuth';
import { pushNotification } from '../lib/notifications';

const router = express.Router();
router.use((_req: Request, res: Response, next) => {
  res.setHeader('x-tasks-route-hit', '1');
  next();
});
router.get('/_debug/version', (_req: Request, res: Response) => {
  return res.json({
    router: 'tasks',
    commit:
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      'unknown',
    env: process.env.NODE_ENV || 'unknown',
  });
});

router.get('/_debug/lookup/:id', async (req: Request, res: Response) => {
  const taskId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!taskId || !isUuid(taskId)) return res.status(400).json({ error: 'invalid_task_id_format' });
  const requestWorkspaceId = String(req.headers['x-workspace-id'] || '').trim() || null;

  const { data, error } = await getBypassClient()
    .from('tasks')
    .select('id,workspace_id,created_by_user_id,assigned_to_user_id,status,created_at')
    .eq('id', taskId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message || 'debug_lookup_failed' });
  if (!data) {
    return res.json({
      exists: false,
      task_id: taskId,
      request_workspace_id: requestWorkspaceId,
    });
  }

  return res.json({
    exists: true,
    task: data,
    request_workspace_id: requestWorkspaceId,
    workspace_matches_request: Boolean(requestWorkspaceId) ? String((data as any).workspace_id) === requestWorkspaceId : null,
  });
});
router.use(attachApiKeyAuth as any, requireAuth as any, activeWorkspace as any);

const DEFAULT_API_KEY_TASK_SCOPES = ['tasks:read', 'tasks:write'];

function getEffectiveApiKeyScopes(req: Request): string[] {
  const scopes = Array.isArray((req as any).apiKeyScopes) ? (req as any).apiKeyScopes : [];
  if (scopes.length) return scopes.map((s: any) => String(s));
  return DEFAULT_API_KEY_TASK_SCOPES;
}

function requireTaskApiKeyScope(requiredScope: 'tasks:read' | 'tasks:write') {
  return (req: Request, res: Response, next: any) => {
    const authSource = String((req as any)?.user?._auth_source || '');
    if (authSource !== 'api_key') return next();
    const scopes = getEffectiveApiKeyScopes(req);
    if (scopes.includes(requiredScope) || scopes.includes('tasks:*') || scopes.includes('*')) return next();
    return res.status(403).json({ error: 'insufficient_scope', missing: [requiredScope] });
  };
}

type Membership = {
  role: string | null;
  status: string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_PARAM_PATTERN = ':id([0-9a-fA-F-]{36})';
const TAB_ALIASES = ['assigned_to_me', 'assigned_by_me', 'all_team', 'overdue', 'completed'] as const;
const supabaseBypass = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function getBypassClient() {
  const candidate = supabaseBypass as any;
  if (candidate && typeof candidate.from === 'function') return candidate;
  return supabase as any;
}

function isUuid(value: string | null | undefined): boolean {
  return UUID_REGEX.test(String(value || '').trim());
}

function cleanUuidInput(value: unknown): string | null {
  const cleaned = String(value || '').trim();
  if (!cleaned) return null;
  if (cleaned.toLowerCase() === 'undefined' || cleaned.toLowerCase() === 'null') return null;
  return isUuid(cleaned) ? cleaned : null;
}

function resolveWorkspaceId(req: Request): string | null {
  const fromHeader = cleanUuidInput(req.headers['x-workspace-id']);
  const fromQuery = cleanUuidInput((req.query as any)?.workspaceId);
  const fromCtx = cleanUuidInput((req as any).workspaceId);
  return fromHeader || fromQuery || fromCtx || null;
}

function normalizeRole(role: string | null | undefined): string {
  return String(role || '').toLowerCase().trim();
}

function isWorkspaceAdminRole(role: string | null | undefined): boolean {
  return ['owner', 'admin', 'team_admin', 'super_admin'].includes(normalizeRole(role));
}

function readRoleFromBearer(req: Request): string | null {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson) as any;
    const appRole = payload?.app_metadata?.role || payload?.user_metadata?.role || payload?.user_metadata?.account_type;
    return appRole ? String(appRole) : null;
  } catch {
    return null;
  }
}

function completedState(task: any): boolean {
  return Boolean(task?.completed_at) || String(task?.status || '').toLowerCase() === 'completed';
}

function toStatusKey(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function toIsoDayBounds(dateInput: string): { start: string; end: string } | null {
  const dt = new Date(dateInput);
  if (Number.isNaN(dt.getTime())) return null;
  const start = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() + 1, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

async function getMembership(userId: string, workspaceId: string): Promise<Membership | null> {
  if (!isUuid(userId) || !isUuid(workspaceId)) return null;
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role,status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  if (String((data as any).status || '').toLowerCase() !== 'active') return null;
  return data as Membership;
}

async function getTaskForWorkspace(taskId: string, workspaceId: string) {
  if (!isUuid(taskId) || !isUuid(workspaceId)) return null;
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as any;
}

type MentionCandidate = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
};

function normalizeMentionText(input: unknown): string {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMentionAliases(user: MentionCandidate): string[] {
  const emailLocal = String(user.email || '').split('@')[0] || '';
  const rawAliases = [
    user.fullName,
    `${user.firstName} ${user.lastName}`.trim(),
    user.firstName,
    user.lastName,
    user.email,
    emailLocal,
  ];
  const deduped = new Set<string>();
  rawAliases.forEach((alias) => {
    const normalized = normalizeMentionText(alias);
    if (normalized.length >= 2) deduped.add(normalized);
  });
  return Array.from(deduped);
}

function resolveMentionedUserIds(commentBody: string, candidates: MentionCandidate[]): string[] {
  const text = normalizeMentionText(commentBody);
  if (!text.includes('@')) return [];
  const mentioned = new Set<string>();
  candidates.forEach((candidate) => {
    const aliases = buildMentionAliases(candidate);
    if (aliases.some((alias) => text.includes(`@${alias}`))) mentioned.add(candidate.id);
  });
  return Array.from(mentioned);
}

async function getWorkspaceMentionCandidates(workspaceId: string): Promise<MentionCandidate[]> {
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id,status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (membersError || !Array.isArray(members) || !members.length) return [];
  const userIds = members.map((row: any) => String(row.user_id || '').trim()).filter(isUuid);
  if (!userIds.length) return [];

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id,first_name,last_name,full_name,email')
    .in('id', userIds);
  if (usersError || !Array.isArray(users)) return [];

  return users
    .map((user: any) => {
      const firstName = String(user.first_name || '').trim();
      const lastName = String(user.last_name || '').trim();
      const fullName =
        String(user.full_name || '').trim() ||
        [firstName, lastName].filter(Boolean).join(' ').trim() ||
        String(user.email || '').trim();
      return {
        id: String(user.id || '').trim(),
        email: String(user.email || '').trim(),
        firstName,
        lastName,
        fullName,
      };
    })
    .filter((user) => isUuid(user.id));
}

async function getGlobalRole(userId: string): Promise<string | null> {
  if (!isUuid(userId)) return null;
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return String((data as any).role || '').trim() || null;
}

async function resolveEffectiveGlobalRole(userId: string, requestRole: unknown): Promise<string | null> {
  const fromDb = await getGlobalRole(userId);
  const fromRequest = String(requestRole || '').trim();
  return fromDb || fromRequest || null;
}

async function getTaskForUser(taskId: string, userId: string, preferredWorkspaceId: string, globalRole: string | null) {
  if (!isUuid(taskId) || !isUuid(userId)) return null;
  const hasGlobalAdmin = isWorkspaceAdminRole(globalRole);

  const preferredTask = await getTaskForWorkspace(taskId, preferredWorkspaceId);
  if (preferredTask) {
    const preferredMembership = await getMembership(userId, preferredWorkspaceId);
    if ((preferredMembership && canViewTask(preferredTask, userId, preferredMembership.role)) || hasGlobalAdmin) {
      return {
        task: preferredTask,
        workspaceId: preferredWorkspaceId,
        membershipRole: preferredMembership?.role || globalRole,
      };
    }
  }

  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (error || !data) return null;

  const actualWorkspaceId = String((data as any).workspace_id || '').trim();
  if (!isUuid(actualWorkspaceId)) return null;

  const actualMembership = await getMembership(userId, actualWorkspaceId);
  if (!actualMembership && !hasGlobalAdmin) return null;
  if (actualMembership && !canViewTask(data, userId, actualMembership.role) && !hasGlobalAdmin) return null;

  return {
    task: data as any,
    workspaceId: actualWorkspaceId,
    membershipRole: actualMembership?.role || globalRole,
  };
}

function canViewTask(task: any, userId: string, membershipRole: string | null): boolean {
  if (!task) return false;
  if (task.assigned_to_user_id === userId) return true;
  if (task.created_by_user_id === userId) return true;
  return isWorkspaceAdminRole(membershipRole);
}

function canUpdateTask(task: any, userId: string, membershipRole: string | null): boolean {
  if (!task) return false;
  if (task.assigned_to_user_id === userId) return true;
  if (task.created_by_user_id === userId) return true;
  return isWorkspaceAdminRole(membershipRole);
}

function canDeleteTask(task: any, userId: string, membershipRole: string | null): boolean {
  if (!task) return false;
  if (task.created_by_user_id === userId) return true;
  return isWorkspaceAdminRole(membershipRole);
}

function buildTaskResponse(task: any, commentCount = 0) {
  return {
    ...task,
    comment_count: commentCount,
    linked_object: {
      related_type: task.related_type || null,
      related_id: task.related_id || null,
    },
  };
}

function respondInternalError(res: Response, tag: string, fallback: string, error: any) {
  if (res.headersSent) {
    console.error(`[${tag}] error after response sent`, error);
    return;
  }
  return res.status(500).json({ error: error?.message || fallback });
}

function selectDbClient(hasGlobalAdmin: boolean) {
  const preferred = hasGlobalAdmin ? (supabaseBypass as any) : (supabase as any);
  if (preferred && typeof preferred.from === 'function') return preferred;
  return supabase as any;
}

const statusesHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const { data, error } = await supabase
      .from('task_statuses')
      .select('id,workspace_id,key,label,sort_order,is_default,created_at,updated_at')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) return res.status(500).json({ error: error.message || 'statuses_fetch_failed' });
    return res.json({ statuses: data || [] });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:statuses', 'statuses_fetch_failed', e);
  }
};

router.get('/statuses', requireTaskApiKeyScope('tasks:read'), statusesHandler);

router.post('/statuses', requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });
    if (!isWorkspaceAdminRole(membership.role)) return res.status(403).json({ error: 'status_admin_required' });

    const payload = req.body || {};
    const label = String(payload.label || '').trim().slice(0, 80);
    if (!label) return res.status(400).json({ error: 'status_label_required' });

    const key = toStatusKey(String(payload.key || label));
    if (!key) return res.status(400).json({ error: 'status_key_invalid' });

    const requestedSort = Number(payload.sort_order);
    const sortOrder = Number.isFinite(requestedSort) ? requestedSort : 100;

    const { data, error } = await supabase
      .from('task_statuses')
      .upsert(
        {
          workspace_id: workspaceId,
          key,
          label,
          sort_order: sortOrder,
          is_default: false,
        },
        { onConflict: 'workspace_id,key' },
      )
      .select('id,workspace_id,key,label,sort_order,is_default,created_at,updated_at')
      .single();

    if (error) return res.status(500).json({ error: error.message || 'status_create_failed' });
    return res.status(201).json({ status: data });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:statuses:create', 'status_create_failed', e);
  }
});

async function resolveRecordRequestContext(req: Request, explicitTaskId: string | null = null) {
  const taskId = String(explicitTaskId || (typeof req.params.id === 'string' ? req.params.id : '') || '').trim();
  if (!taskId || !isUuid(taskId)) return { error: { status: 400, body: { error: 'invalid_task_id_format' } } } as const;

  const userId = String((req as any)?.user?.id || '').trim();
  if (!userId) return { error: { status: 401, body: { error: 'unauthorized' } } } as const;

  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) return { error: { status: 400, body: { error: 'workspace_required' } } } as const;

  const membership = await getMembership(userId, workspaceId);
  if (!membership) return { error: { status: 403, body: { error: 'workspace_forbidden' } } } as const;

  const task = await getTaskForWorkspace(taskId, workspaceId);
  if (!task) return { taskId, userId, workspaceId, membership, task: null } as const;

  if (!canViewTask(task, userId, membership.role)) {
    return { error: { status: 403, body: { error: 'forbidden' } } } as const;
  }

  return { taskId, userId, workspaceId, membership, task } as const;
}

function readRecordTaskId(req: Request): string {
  const fromQuery = String((req.query as any)?.task_id || '').trim();
  const fromBody = String((req.body as any)?.task_id || '').trim();
  return fromQuery || fromBody || '';
}

router.get('/record', requireTaskApiKeyScope('tasks:read'), async (req: Request, res: Response) => {
  try {
    const parsedTaskId = readRecordTaskId(req);
    res.setHeader('x-tasks-record-v3-route', 'record');
    res.setHeader('x-tasks-record-v3-task-id', parsedTaskId || 'missing');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/618677c7-c76b-4616-acaf-83dcd722fe68',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'record400-debug-run3',hypothesisId:'H7',location:'routes/tasks.ts:get-record:v3:entry',message:'record v3 endpoint entry',data:{path:req.path,queryTaskId:String((req.query as any)?.task_id||''),parsedTaskId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const taskId = readRecordTaskId(req);
    if (!taskId) return res.status(400).json({ error: 'task_id_required' });
    const ctx = await resolveRecordRequestContext(req as any, taskId);
    if ('error' in ctx) return res.status(ctx.error.status).json(ctx.error.body);
    if (!ctx.task) return res.json({ task: null });

    const { count, error } = await supabase
      .from('task_comments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('task_id', ctx.taskId);
    if (error) return res.status(500).json({ error: error.message || 'task_fetch_failed' });

    res.setHeader('x-tasks-record-v3-hit', '1');
    return res.json({ task: buildTaskResponse(ctx.task, Number(count || 0)) });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:record:get-by-id:v3', 'task_fetch_failed', e);
  }
});

router.get('/record/comments', requireTaskApiKeyScope('tasks:read'), async (req: Request, res: Response) => {
  try {
    const parsedTaskId = readRecordTaskId(req);
    res.setHeader('x-tasks-record-v3-route', 'record-comments');
    res.setHeader('x-tasks-record-v3-task-id', parsedTaskId || 'missing');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/618677c7-c76b-4616-acaf-83dcd722fe68',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'record400-debug-run3',hypothesisId:'H8',location:'routes/tasks.ts:get-record-comments:v3:entry',message:'record comments v3 endpoint entry',data:{path:req.path,queryTaskId:String((req.query as any)?.task_id||''),parsedTaskId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const taskId = readRecordTaskId(req);
    if (!taskId) return res.status(400).json({ error: 'task_id_required' });
    const ctx = await resolveRecordRequestContext(req as any, taskId);
    if ('error' in ctx) return res.status(ctx.error.status).json(ctx.error.body);
    if (!ctx.task) return res.json({ comments: [] });

    const { data, error } = await supabase
      .from('task_comments')
      .select('id,workspace_id,task_id,user_id,body,created_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('task_id', ctx.taskId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message || 'task_comments_list_failed' });

    res.setHeader('x-tasks-record-v3-hit', '1');
    return res.json({ comments: data || [] });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:record:comments:list:v3', 'task_comments_list_failed', e);
  }
});

router.post('/record/comments', requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    const taskId = readRecordTaskId(req);
    if (!taskId) return res.status(400).json({ error: 'task_id_required' });
    const ctx = await resolveRecordRequestContext(req as any, taskId);
    if ('error' in ctx) return res.status(ctx.error.status).json(ctx.error.body);
    if (!ctx.task) return res.status(404).json({ error: 'task_not_found' });
    if (!canUpdateTask(ctx.task, ctx.userId, ctx.membership.role)) return res.status(403).json({ error: 'forbidden' });

    const body = String((req.body || {}).body || '').trim();
    if (!body) return res.status(400).json({ error: 'comment_body_required' });

    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        workspace_id: ctx.workspaceId,
        task_id: ctx.taskId,
        user_id: ctx.userId,
        body,
      })
      .select('id,workspace_id,task_id,user_id,body,created_at')
      .single();
    if (error) return res.status(500).json({ error: error.message || 'task_comment_create_failed' });

    try {
      const candidates = await getWorkspaceMentionCandidates(ctx.workspaceId);
      const mentionedUserIds = resolveMentionedUserIds(body, candidates).filter((id) => id !== ctx.userId);
      if (mentionedUserIds.length) {
        const actor = candidates.find((user) => user.id === ctx.userId);
        const actorLabel = actor?.fullName || actor?.email || 'A teammate';
        const taskTitle = String(ctx.task.title || 'Task').trim() || 'Task';
        const snippet = body.length > 180 ? `${body.slice(0, 177)}...` : body;
        await Promise.all(
          mentionedUserIds.map(async (targetUserId) => {
            await pushNotification({
              user_id: targetUserId,
              source: 'inapp',
              thread_key: `task:${ctx.taskId}`,
              title: `${actorLabel} mentioned you on ${taskTitle}`,
              body_md: snippet,
              type: 'task_mention',
              metadata: {
                workspace_id: ctx.workspaceId,
                task_id: ctx.taskId,
                comment_id: (data as any)?.id || null,
              },
            } as any);
          }),
        );
      }
    } catch {}

    res.setHeader('x-tasks-record-v3-hit', '1');
    return res.status(201).json({ comment: data });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:record:comments:create:v3', 'task_comment_create_failed', e);
  }
});

const listTasksHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const tab = String((req.query as any)?.tab || 'assigned_to_me');
    const search = String((req.query as any)?.search || '').trim();
    const status = String((req.query as any)?.status || '').trim();
    const assignee = String((req.query as any)?.assignee || '').trim();
    const due = String((req.query as any)?.due || '').trim().toLowerCase();
    const relatedType = String((req.query as any)?.related_type || '').trim();
    const relatedId = String((req.query as any)?.related_id || '').trim();
    const canViewAllTeam = isWorkspaceAdminRole(membership.role);

    if (tab === 'all_team' && !canViewAllTeam) {
      return res.status(403).json({ error: 'all_team_forbidden' });
    }

    let query = supabase
      .from('tasks')
      .select(
        'id,workspace_id,created_by_user_id,assigned_to_user_id,title,description,status,priority,due_at,completed_at,related_type,related_id,created_at,updated_at',
      )
      .eq('workspace_id', workspaceId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (search) {
      const safe = search.replace(/[%]/g, '');
      query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    if (status) query = query.eq('status', status);
    if (assignee) {
      const parsedAssignee = cleanUuidInput(assignee);
      if (!parsedAssignee) return res.status(400).json({ error: 'assignee_id_invalid' });
      query = query.eq('assigned_to_user_id', parsedAssignee);
    }
    if (relatedType) query = query.eq('related_type', relatedType);
    if (relatedId) {
      const parsedRelatedId = cleanUuidInput(relatedId);
      if (!parsedRelatedId) return res.status(400).json({ error: 'related_id_invalid' });
      query = query.eq('related_id', parsedRelatedId);
    }

    if (due === 'none') query = query.is('due_at', null);
    if (due === 'overdue') {
      const nowIso = new Date().toISOString();
      query = query.lt('due_at', nowIso).neq('status', 'completed');
    }
    if (due === 'today') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString();
      query = query.gte('due_at', start).lt('due_at', end);
    }
    if (due && /^\d{4}-\d{2}-\d{2}$/.test(due)) {
      const bounds = toIsoDayBounds(due);
      if (bounds) query = query.gte('due_at', bounds.start).lt('due_at', bounds.end);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message || 'tasks_list_failed' });

    const nowIso = new Date().toISOString();
    const filteredByTab = (data || []).filter((task) => {
      const isCompleted = completedState(task);
      if (tab === 'assigned_to_me') return task.assigned_to_user_id === userId && !isCompleted;
      if (tab === 'assigned_by_me') return task.created_by_user_id === userId && !isCompleted;
      if (tab === 'all_team') return !isCompleted;
      if (tab === 'overdue') return Boolean(task.due_at) && String(task.due_at) < nowIso && !isCompleted;
      if (tab === 'completed') return isCompleted;
      return true;
    });

    const visibilityScoped = filteredByTab.filter((task) => canViewTask(task, userId, membership.role));
    const taskIds = visibilityScoped.map((t) => t.id);

    let commentCountByTask: Record<string, number> = {};
    if (taskIds.length) {
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select('task_id')
        .eq('workspace_id', workspaceId)
        .in('task_id', taskIds);
      if (commentsError) return res.status(500).json({ error: commentsError.message || 'task_comments_count_failed' });
      commentCountByTask = (comments || []).reduce((acc: Record<string, number>, row: any) => {
        const taskId = String(row.task_id);
        acc[taskId] = (acc[taskId] || 0) + 1;
        return acc;
      }, {});
    }

    const tasks = visibilityScoped.map((task) => buildTaskResponse(task, commentCountByTask[task.id] || 0));

    return res.json({ tasks });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:list', 'tasks_list_failed', e);
  }
};

router.get('/', requireTaskApiKeyScope('tasks:read'), listTasksHandler);
router.get('', requireTaskApiKeyScope('tasks:read'), listTasksHandler);

TAB_ALIASES.forEach((tabKey) => {
  router.get(`/${tabKey}`, requireTaskApiKeyScope('tasks:read'), (req: Request, res: Response) => {
    const params = new URLSearchParams((req.query as any) || {});
    params.set('tab', tabKey);
    return res.redirect(307, `/api/tasks?${params.toString()}`);
  });
});

router.get('/:id', requireTaskApiKeyScope('tasks:read'), async (req: Request, res: Response) => {
  try {
    const taskId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (taskId === 'statuses') return statusesHandler(req, res);
    if ((TAB_ALIASES as readonly string[]).includes(taskId)) {
      const params = new URLSearchParams((req.query as any) || {});
      params.set('tab', taskId);
      return res.redirect(307, `/api/tasks?${params.toString()}`);
    }
    if (!taskId || !isUuid(taskId)) return res.status(400).json({ error: 'invalid_task_id_format' });

    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const globalRole = await resolveEffectiveGlobalRole(userId, (req as any)?.user?.role);
    const hasGlobalAdmin = isWorkspaceAdminRole(globalRole);
    const membership = await getMembership(userId, workspaceId);
    if (!membership && !hasGlobalAdmin) return res.status(403).json({ error: 'workspace_forbidden' });

    const resolved = await getTaskForUser(taskId, userId, workspaceId, globalRole);
    if (!resolved) return res.json({ task: null });

    const { data: comments, error: commentsError } = await supabase
      .from('task_comments')
      .select('task_id')
      .eq('workspace_id', resolved.workspaceId)
      .eq('task_id', taskId);
    if (commentsError) return res.status(500).json({ error: commentsError.message || 'task_fetch_failed' });

    return res.json({
      task: buildTaskResponse(resolved.task, (comments || []).length),
    });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:get-by-id', 'task_fetch_failed', e);
  }
});

const createTaskHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const payload = req.body || {};
    const title = String(payload.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title_required' });

    const assignedTo = cleanUuidInput(payload.assigned_to_user_id);
    if (assignedTo) {
      const assignedMembership = await getMembership(assignedTo, workspaceId);
      if (!assignedMembership) return res.status(400).json({ error: 'assignee_not_in_workspace' });
    }
    if (typeof payload.assigned_to_user_id !== 'undefined' && !assignedTo && payload.assigned_to_user_id) {
      return res.status(400).json({ error: 'assignee_id_invalid' });
    }

    const relatedId = typeof payload.related_id === 'undefined' ? null : cleanUuidInput(payload.related_id);
    if (typeof payload.related_id !== 'undefined' && payload.related_id && !relatedId) {
      return res.status(400).json({ error: 'related_id_invalid' });
    }

    const insertPayload: any = {
      workspace_id: workspaceId,
      created_by_user_id: userId,
      assigned_to_user_id: assignedTo,
      title,
      description: payload.description ? String(payload.description) : null,
      status: payload.status ? String(payload.status) : 'open',
      priority: payload.priority ? String(payload.priority) : 'medium',
      due_at: payload.due_at || null,
      related_type: payload.related_type ? String(payload.related_type) : null,
      related_id: relatedId,
    };

    const { data, error } = await supabase.from('tasks').insert(insertPayload).select('*').single();
    if (error) return res.status(500).json({ error: error.message || 'task_create_failed' });

    return res.status(201).json({ task: buildTaskResponse(data, 0) });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:create', 'task_create_failed', e);
  }
};

router.post('/', requireTaskApiKeyScope('tasks:write'), createTaskHandler);
router.post('', requireTaskApiKeyScope('tasks:write'), createTaskHandler);

router.post('/from-note', requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const payload = req.body || {};
    const noteText = String(payload.note || payload.body || payload.text || '').trim();
    if (!noteText) return res.status(400).json({ error: 'note_required' });

    const firstLine = noteText.split('\n').map((line) => line.trim()).find(Boolean) || 'Untitled task';
    const autoTitle = firstLine.slice(0, 80);
    const title = String(payload.title || autoTitle).trim();
    if (!title) return res.status(400).json({ error: 'title_required' });

    const assignedTo = cleanUuidInput(payload.assigned_to_user_id);
    if (assignedTo) {
      const assignedMembership = await getMembership(assignedTo, workspaceId);
      if (!assignedMembership) return res.status(400).json({ error: 'assignee_not_in_workspace' });
    }
    if (typeof payload.assigned_to_user_id !== 'undefined' && !assignedTo && payload.assigned_to_user_id) {
      return res.status(400).json({ error: 'assignee_id_invalid' });
    }

    const relatedId = typeof payload.related_id === 'undefined' ? null : cleanUuidInput(payload.related_id);
    if (typeof payload.related_id !== 'undefined' && payload.related_id && !relatedId) {
      return res.status(400).json({ error: 'related_id_invalid' });
    }

    const insertPayload: any = {
      workspace_id: workspaceId,
      created_by_user_id: userId,
      assigned_to_user_id: assignedTo,
      title,
      description: String(payload.description || noteText || '').trim() || null,
      status: payload.status ? String(payload.status) : 'open',
      priority: payload.priority ? String(payload.priority) : 'medium',
      due_at: payload.due_at || null,
      related_type: payload.related_type ? String(payload.related_type) : null,
      related_id: relatedId,
    };

    const { data, error } = await supabase.from('tasks').insert(insertPayload).select('*').single();
    if (error) return res.status(500).json({ error: error.message || 'task_from_note_failed' });

    return res.status(201).json({
      task: buildTaskResponse(data, 0),
      source: {
        title_prefilled_from_note: autoTitle,
      },
    });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:from-note', 'task_from_note_failed', e);
  }
});

router.patch(`/${UUID_PARAM_PATTERN}`, requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'task_id_invalid' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const task = await getTaskForWorkspace(req.params.id, workspaceId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });
    if (!canUpdateTask(task, userId, membership.role)) return res.status(403).json({ error: 'forbidden' });

    const payload = req.body || {};
    const updates: any = {};

    if (typeof payload.title !== 'undefined') {
      const title = String(payload.title || '').trim();
      if (!title) return res.status(400).json({ error: 'title_required' });
      updates.title = title;
    }
    if (typeof payload.description !== 'undefined') updates.description = payload.description ? String(payload.description) : null;
    if (typeof payload.status !== 'undefined') updates.status = String(payload.status || 'open');
    if (typeof payload.priority !== 'undefined') updates.priority = String(payload.priority || 'medium');
    if (typeof payload.due_at !== 'undefined') updates.due_at = payload.due_at || null;
    if (typeof payload.related_type !== 'undefined') updates.related_type = payload.related_type ? String(payload.related_type) : null;
    if (typeof payload.related_id !== 'undefined') {
      if (!payload.related_id) {
        updates.related_id = null;
      } else {
        const relatedId = cleanUuidInput(payload.related_id);
        if (!relatedId) return res.status(400).json({ error: 'related_id_invalid' });
        updates.related_id = relatedId;
      }
    }

    if (typeof payload.assigned_to_user_id !== 'undefined') {
      const assignedTo = cleanUuidInput(payload.assigned_to_user_id);
      if (assignedTo) {
        const assignedMembership = await getMembership(assignedTo, workspaceId);
        if (!assignedMembership) return res.status(400).json({ error: 'assignee_not_in_workspace' });
      }
      if (!assignedTo && payload.assigned_to_user_id) return res.status(400).json({ error: 'assignee_id_invalid' });
      updates.assigned_to_user_id = assignedTo;
    }

    if (typeof payload.status !== 'undefined') {
      const nextStatus = String(payload.status || '').toLowerCase();
      updates.completed_at = nextStatus === 'completed' ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message || 'task_update_failed' });

    return res.json({
      task: buildTaskResponse(data),
    });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:update', 'task_update_failed', e);
  }
});

router.patch(`/${UUID_PARAM_PATTERN}/status`, requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'task_id_invalid' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const task = await getTaskForWorkspace(req.params.id, workspaceId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });
    if (!canUpdateTask(task, userId, membership.role)) return res.status(403).json({ error: 'forbidden' });

    const status = String((req.body || {}).status || '').trim();
    if (!status) return res.status(400).json({ error: 'status_required' });

    const normalized = status.toLowerCase();
    const updates: any = {
      status,
      completed_at: normalized === 'completed' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message || 'task_status_update_failed' });
    return res.json({ task: data });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:patch-status', 'task_status_update_failed', e);
  }
});

router.post('/bulk/status', requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const payload = req.body || {};
    const rawTaskIds = Array.isArray(payload.task_ids) ? payload.task_ids : [];
    const taskIds: string[] = [];
    for (const rawId of rawTaskIds) {
      const parsed = cleanUuidInput(rawId);
      if (!parsed) return res.status(400).json({ error: 'task_id_invalid' });
      taskIds.push(parsed);
    }
    const status = String(payload.status || '').trim();
    if (!taskIds.length) return res.status(400).json({ error: 'task_ids_required' });
    if (!status) return res.status(400).json({ error: 'status_required' });

    const { data: rows, error: rowsError } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('id', taskIds);
    if (rowsError) return res.status(500).json({ error: rowsError.message || 'task_bulk_status_failed' });

    const normalizedStatus = status.toLowerCase();
    const completedAt = normalizedStatus === 'completed' ? new Date().toISOString() : null;

    const allowed = (rows || []).filter((task: any) => canUpdateTask(task, userId, membership.role));
    const allowedIds = allowed.map((t: any) => String(t.id));
    const skippedIds = taskIds.filter((id: string) => !allowedIds.includes(id));

    let updatedRows: any[] = [];
    if (allowedIds.length) {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status, completed_at: completedAt })
        .eq('workspace_id', workspaceId)
        .in('id', allowedIds)
        .select('*');
      if (error) return res.status(500).json({ error: error.message || 'task_bulk_status_failed' });
      updatedRows = data || [];
    }

    return res.json({
      updated_count: updatedRows.length,
      skipped_count: skippedIds.length,
      skipped_ids: skippedIds,
      tasks: updatedRows.map((task) => buildTaskResponse(task)),
    });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:bulk-status', 'task_bulk_status_failed', e);
  }
});

router.post(`/${UUID_PARAM_PATTERN}/follow-up`, requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'task_id_invalid' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const sourceTask = await getTaskForWorkspace(req.params.id, workspaceId);
    if (!sourceTask) return res.status(404).json({ error: 'task_not_found' });
    if (!canUpdateTask(sourceTask, userId, membership.role)) return res.status(403).json({ error: 'forbidden' });

    const payload = req.body || {};
    const assignedTo =
      typeof payload.assigned_to_user_id !== 'undefined'
        ? cleanUuidInput(payload.assigned_to_user_id)
        : (sourceTask.assigned_to_user_id || null);
    if (typeof payload.assigned_to_user_id !== 'undefined' && payload.assigned_to_user_id && !assignedTo) {
      return res.status(400).json({ error: 'assignee_id_invalid' });
    }
    if (assignedTo) {
      const assignedMembership = await getMembership(assignedTo, workspaceId);
      if (!assignedMembership) return res.status(400).json({ error: 'assignee_not_in_workspace' });
    }

    let dueAt = payload.due_at || null;
    if (!dueAt && typeof payload.due_in_days !== 'undefined') {
      const days = Number(payload.due_in_days);
      if (Number.isFinite(days)) dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    if (!dueAt && typeof payload.due_in_hours !== 'undefined') {
      const hours = Number(payload.due_in_hours);
      if (Number.isFinite(hours)) dueAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const title = String(payload.title || `Follow-up: ${String(sourceTask.title || '').trim()}`).trim().slice(0, 500);
    if (!title) return res.status(400).json({ error: 'title_required' });

    const relatedId =
      typeof payload.related_id !== 'undefined'
        ? cleanUuidInput(payload.related_id)
        : (sourceTask.related_id || null);
    if (typeof payload.related_id !== 'undefined' && payload.related_id && !relatedId) {
      return res.status(400).json({ error: 'related_id_invalid' });
    }

    const insertPayload: any = {
      workspace_id: workspaceId,
      created_by_user_id: userId,
      assigned_to_user_id: assignedTo,
      title,
      description:
        typeof payload.description !== 'undefined'
          ? (payload.description ? String(payload.description) : null)
          : (sourceTask.description || null),
      status: payload.status ? String(payload.status) : 'open',
      priority: payload.priority ? String(payload.priority) : (sourceTask.priority || 'medium'),
      due_at: dueAt,
      related_type: payload.related_type ? String(payload.related_type) : (sourceTask.related_type || null),
      related_id: relatedId,
    };

    const { data, error } = await supabase.from('tasks').insert(insertPayload).select('*').single();
    if (error) return res.status(500).json({ error: error.message || 'task_follow_up_failed' });

    return res.status(201).json({
      task: buildTaskResponse(data, 0),
      source_task_id: sourceTask.id,
    });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:follow-up', 'task_follow_up_failed', e);
  }
});

router.post(`/${UUID_PARAM_PATTERN}/complete`, requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'task_id_invalid' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const task = await getTaskForWorkspace(req.params.id, workspaceId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });
    if (!canUpdateTask(task, userId, membership.role)) return res.status(403).json({ error: 'forbidden' });

    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message || 'task_complete_failed' });

    return res.json({ task: data });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:complete', 'task_complete_failed', e);
  }
});

router.post(`/${UUID_PARAM_PATTERN}/reopen`, requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'task_id_invalid' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const task = await getTaskForWorkspace(req.params.id, workspaceId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });
    if (!canUpdateTask(task, userId, membership.role)) return res.status(403).json({ error: 'forbidden' });

    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'open', completed_at: null })
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message || 'task_reopen_failed' });

    return res.json({ task: data });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:reopen', 'task_reopen_failed', e);
  }
});

router.get('/:id/comments', requireTaskApiKeyScope('tasks:read'), async (req: Request, res: Response) => {
  try {
    const taskId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!taskId || !isUuid(taskId)) return res.status(400).json({ error: 'invalid_task_id_format' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const globalRole = await resolveEffectiveGlobalRole(userId, (req as any)?.user?.role);
    const hasGlobalAdmin = isWorkspaceAdminRole(globalRole);
    const membership = await getMembership(userId, workspaceId);
    if (!membership && !hasGlobalAdmin) return res.status(403).json({ error: 'workspace_forbidden' });

    const resolved = await getTaskForUser(taskId, userId, workspaceId, globalRole);
    if (!resolved) return res.json({ comments: [] });

    const { data, error } = await supabase
      .from('task_comments')
      .select('id,workspace_id,task_id,user_id,body,created_at')
      .eq('workspace_id', resolved.workspaceId)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message || 'task_comments_list_failed' });
    return res.json({ comments: data || [] });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:comments:list', 'task_comments_list_failed', e);
  }
});

router.post('/:id/comments', requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    const taskId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!taskId || !isUuid(taskId)) return res.status(400).json({ error: 'invalid_task_id_format' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const globalRole = await resolveEffectiveGlobalRole(userId, (req as any)?.user?.role);
    const hasGlobalAdmin = isWorkspaceAdminRole(globalRole);
    const membership = await getMembership(userId, workspaceId);
    if (!membership && !hasGlobalAdmin) return res.status(403).json({ error: 'workspace_forbidden' });

    const resolved = await getTaskForUser(taskId, userId, workspaceId, globalRole);
    if (!resolved) return res.status(404).json({ error: 'task_not_found' });

    const body = String((req.body || {}).body || '').trim();
    if (!body) return res.status(400).json({ error: 'comment_body_required' });

    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        workspace_id: resolved.workspaceId,
        task_id: taskId,
        user_id: userId,
        body,
      })
      .select('id,workspace_id,task_id,user_id,body,created_at')
      .single();

    if (error) return res.status(500).json({ error: error.message || 'task_comment_create_failed' });
    return res.status(201).json({ comment: data });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:comments:create', 'task_comment_create_failed', e);
  }
});

router.delete(`/${UUID_PARAM_PATTERN}`, requireTaskApiKeyScope('tasks:write'), async (req: Request, res: Response) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'task_id_invalid' });
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'workspace_required' });

    const membership = await getMembership(userId, workspaceId);
    if (!membership) return res.status(403).json({ error: 'workspace_forbidden' });

    const task = await getTaskForWorkspace(req.params.id, workspaceId);
    if (!task) return res.status(404).json({ error: 'task_not_found' });
    if (!canDeleteTask(task, userId, membership.role)) return res.status(403).json({ error: 'forbidden' });

    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id).eq('workspace_id', workspaceId);
    if (error) return res.status(500).json({ error: error.message || 'task_delete_failed' });
    return res.json({ ok: true });
  } catch (e: any) {
    return respondInternalError(res, 'tasks:delete', 'task_delete_failed', e);
  }
});

router.all('*', (req: Request, res: Response) => {
  return res.status(404).json({
    error: 'tasks_route_not_found',
    method: req.method,
    path: req.path,
  });
});

export default router;
