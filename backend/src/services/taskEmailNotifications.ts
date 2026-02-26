/**
 * Task email notifications: assigned, comment, completed.
 * Server-side only. Uses dedupe table to prevent duplicate sends on rapid updates.
 */
import { createClient } from '@supabase/supabase-js';
import {
  renderTaskAssignedEmail,
  renderTaskCommentEmail,
  renderTaskCompletedEmail,
  type TaskEmailBrand,
} from '../emails/tasksEmailTemplates';
import { sendEmail } from '../lib/email/sendEmail';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.thehirepilot.com';
const LOGO_URL = process.env.HIREPILOT_LOGO_URL || `${APP_URL}/logo-light.png`;

const BRAND: TaskEmailBrand = {
  appName: 'HirePilot',
  appUrl: APP_URL,
  logoUrl: LOGO_URL,
  accent: '#7C3AED',
  supportEmail: 'support@thehirepilot.com',
};

type UserInfo = { email: string; fullName: string };

async function getUserInfo(userId: string | null): Promise<UserInfo | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from('users')
    .select('email,first_name,last_name,full_name')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  const email = String((data as any).email || '').trim();
  if (!email) return null;
  const fn = String((data as any).first_name || '').trim();
  const ln = String((data as any).last_name || '').trim();
  const full = String((data as any).full_name || '').trim();
  const fullName = full || [fn, ln].filter(Boolean).join(' ').trim() || email;
  return { email, fullName };
}

async function getWorkspaceName(workspaceId: string): Promise<string | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .maybeSingle();
  return data ? String((data as any).name || '').trim() || null : null;
}

function formatDueAt(dueAt: string | null | undefined): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCompletedAt(completedAt: string | null | undefined): string | null {
  if (!completedAt) return null;
  const d = new Date(completedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncateComment(body: string, max = 300): string {
  const s = String(body || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

const taskUrl = (taskId: string) => `${APP_URL}/tasks?taskId=${encodeURIComponent(taskId)}`;

/** Try to record event. Returns true if inserted (first in window), false if duplicate. */
async function tryRecordEvent(
  workspaceId: string,
  taskId: string,
  eventType: 'assigned' | 'comment' | 'completed',
  recipientEmail: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('task_email_events').insert({
      workspace_id: workspaceId,
      task_id: taskId,
      event_type: eventType,
      recipient_email: recipientEmail.toLowerCase().trim(),
    });
    if (error) {
      if (error.code === '23505') return false; // unique_violation
      console.warn('[taskEmail] record event error', error.code, error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Check user is in workspace (members or super admin). We already validated in route. */
async function userInWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  const { data: wm } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (wm) return true;
  const { data: u } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  const role = String((u as any)?.role || '').toLowerCase();
  return role === 'super_admin' || role === 'superadmin';
}

export async function sendTaskAssignedEmail(opts: {
  workspaceId: string;
  task: { id: string; title: string; description?: string | null; status?: string | null; priority?: string | null; due_at?: string | null; related_type?: string | null; related_id?: string | null };
  assigneeUserId: string;
  assignerUserId: string;
}): Promise<void> {
  try {
    const { workspaceId, task, assigneeUserId, assignerUserId } = opts;

    const assignee = await getUserInfo(assigneeUserId);
    if (!assignee?.email) return;

    const inWorkspace = await userInWorkspace(assigneeUserId, workspaceId);
    if (!inWorkspace) return;

    const ok = await tryRecordEvent(workspaceId, task.id, 'assigned', assignee.email);
    if (!ok) return;

    const assigner = await getUserInfo(assignerUserId);
    const workspaceName = await getWorkspaceName(workspaceId);

    const relatedLabel = task.related_type
      ? `Linked to: ${task.related_type}${task.related_id ? ` #${String(task.related_id).slice(0, 8)}` : ''}`
      : null;

    const rendered = renderTaskAssignedEmail(BRAND, {
      workspaceName: workspaceName || undefined,
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description || null,
      taskStatus: task.status || null,
      taskPriority: task.priority || null,
      dueAt: formatDueAt(task.due_at),
      relatedLabel,
      relatedUrl: null,
      taskUrl: taskUrl(task.id),
      assigneeName: assignee.fullName,
      assignerName: assigner?.fullName || 'A teammate',
      assignerEmail: assigner?.email,
    });

    await sendEmail({ to: assignee.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  } catch (e) {
    console.error('[taskEmail] sendTaskAssignedEmail error', e);
  }
}

export async function sendTaskCommentEmail(opts: {
  workspaceId: string;
  task: { id: string; title: string; description?: string | null; status?: string | null; priority?: string | null; due_at?: string | null; related_type?: string | null; related_id?: string | null };
  assigneeUserId: string | null;
  commenterUserId: string;
  commentBody: string;
}): Promise<void> {
  try {
    const { workspaceId, task, assigneeUserId, commenterUserId, commentBody } = opts;
    if (!assigneeUserId || String(assigneeUserId) === String(commenterUserId)) return;

    const assignee = await getUserInfo(assigneeUserId);
    if (!assignee?.email) return;

    const inWorkspace = await userInWorkspace(assigneeUserId, workspaceId);
    if (!inWorkspace) return;

    const ok = await tryRecordEvent(workspaceId, task.id, 'comment', assignee.email);
    if (!ok) return;

    const commenter = await getUserInfo(commenterUserId);
    const workspaceName = await getWorkspaceName(workspaceId);
    const preview = truncateComment(commentBody, 300);
    const commentUrl = `${APP_URL}/tasks?taskId=${encodeURIComponent(task.id)}`;

    const relatedLabel = task.related_type
      ? `Linked to: ${task.related_type}${task.related_id ? ` #${String(task.related_id).slice(0, 8)}` : ''}`
      : null;

    const rendered = renderTaskCommentEmail(BRAND, {
      workspaceName: workspaceName || undefined,
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description || null,
      taskStatus: task.status || null,
      taskPriority: task.priority || null,
      dueAt: formatDueAt(task.due_at),
      relatedLabel,
      relatedUrl: null,
      taskUrl: taskUrl(task.id),
      assigneeName: assignee.fullName,
      commenterName: commenter?.fullName || 'A teammate',
      commentPreview: preview,
      commentUrl,
    });

    await sendEmail({ to: assignee.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  } catch (e) {
    console.error('[taskEmail] sendTaskCommentEmail error', e);
  }
}

export async function sendTaskCompletedEmail(opts: {
  workspaceId: string;
  task: { id: string; title: string; description?: string | null; status?: string | null; priority?: string | null; due_at?: string | null; completed_at?: string | null; related_type?: string | null; related_id?: string | null };
  assigneeUserId: string | null;
  assignerUserId: string | null;
}): Promise<void> {
  try {
    const { workspaceId, task, assigneeUserId, assignerUserId } = opts;

    const recipients: { email: string; fullName: string }[] = [];
    const seen = new Set<string>();

    if (assigneeUserId) {
      const a = await getUserInfo(assigneeUserId);
      if (a?.email && !seen.has(a.email.toLowerCase())) {
        const inW = await userInWorkspace(assigneeUserId, workspaceId);
        if (inW) {
          seen.add(a.email.toLowerCase());
          recipients.push(a);
        }
      }
    }
    if (assignerUserId) {
      const b = await getUserInfo(assignerUserId);
      if (b?.email && !seen.has(b.email.toLowerCase())) {
        const inW = await userInWorkspace(assignerUserId, workspaceId);
        if (inW) {
          seen.add(b.email.toLowerCase());
          recipients.push(b);
        }
      }
    }

    if (recipients.length === 0) return;

    const workspaceName = await getWorkspaceName(workspaceId);
    const completedAt = formatCompletedAt(task.completed_at);
    const assigneeName = assigneeUserId ? (await getUserInfo(assigneeUserId))?.fullName || 'Assignee' : 'Assignee';
    const assignerName = assignerUserId ? (await getUserInfo(assignerUserId))?.fullName || 'Assigner' : 'Assigner';

    const relatedLabel = task.related_type
      ? `Linked to: ${task.related_type}${task.related_id ? ` #${String(task.related_id).slice(0, 8)}` : ''}`
      : null;

    const input = {
      workspaceName: workspaceName || undefined,
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description || null,
      taskStatus: 'Completed',
      taskPriority: task.priority || null,
      dueAt: formatDueAt(task.due_at),
      relatedLabel,
      relatedUrl: null,
      taskUrl: taskUrl(task.id),
      assigneeName,
      assignerName,
      completedAt,
    };

    const rendered = renderTaskCompletedEmail(BRAND, input);

    for (const r of recipients) {
      const ok = await tryRecordEvent(workspaceId, task.id, 'completed', r.email);
      if (!ok) continue;
      try {
        await sendEmail({ to: r.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
      } catch (e) {
        console.error('[taskEmail] sendTaskCompletedEmail to', r.email, e);
      }
    }
  } catch (e) {
    console.error('[taskEmail] sendTaskCompletedEmail error', e);
  }
}
