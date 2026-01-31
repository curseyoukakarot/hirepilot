import { supabase } from '../../lib/supabase';
import { getBoardById } from './kanbanService';

export type KanbanBindingRow = {
  id: string;
  board_id: string;
  workspace_id: string | null;
  target_type: string;
  target_id: string;
  mode: string | null;
  group_by: string | null;
  column_map: Record<string, string> | null;
  sync_direction: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  archived_at: string | null;
};

function mapBinding(row: KanbanBindingRow) {
  return {
    id: row.id,
    boardId: row.board_id,
    workspaceId: row.workspace_id,
    targetType: row.target_type,
    targetId: row.target_id,
    mode: row.mode,
    groupBy: row.group_by,
    columnMap: row.column_map || {},
    syncDirection: row.sync_direction,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
    archivedAt: row.archived_at,
  };
}

async function assertBoardAccess(boardId: string, userId: string, workspaceId: string | null) {
  await getBoardById(boardId, userId, workspaceId);
}

export async function listBindings(boardId: string, userId: string, workspaceId: string | null) {
  await assertBoardAccess(boardId, userId, workspaceId);
  const { data } = await supabase
    .from('kanban_bindings')
    .select('*')
    .eq('board_id', boardId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  return (data || []).map((row) => mapBinding(row as KanbanBindingRow));
}

export async function createBinding(
  boardId: string,
  userId: string,
  workspaceId: string | null,
  payload: {
    targetType: string;
    targetId: string;
    mode?: string | null;
    groupBy?: string | null;
    columnMap?: Record<string, string> | null;
    syncDirection?: string | null;
  }
) {
  await assertBoardAccess(boardId, userId, workspaceId);
  const { data, error } = await supabase
    .from('kanban_bindings')
    .insert({
      board_id: boardId,
      workspace_id: workspaceId,
      target_type: payload.targetType,
      target_id: payload.targetId,
      mode: payload.mode || 'mirror',
      group_by: payload.groupBy || null,
      column_map: payload.columnMap || {},
      sync_direction: payload.syncDirection || 'bidirectional',
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapBinding(data as KanbanBindingRow);
}

export async function updateBinding(
  bindingId: string,
  userId: string,
  payload: Partial<{
    targetType: string;
    targetId: string;
    mode: string | null;
    groupBy: string | null;
    columnMap: Record<string, string> | null;
    syncDirection: string | null;
    archivedAt: string | null;
  }>
) {
  const { data: existing } = await supabase.from('kanban_bindings').select('*').eq('id', bindingId).maybeSingle();
  if (!existing) throw new Error('binding_not_found');
  await assertBoardAccess(String((existing as any).board_id), userId, String((existing as any).workspace_id || '') || null);
  const { data, error } = await supabase
    .from('kanban_bindings')
    .update({
      target_type: payload.targetType,
      target_id: payload.targetId,
      mode: payload.mode,
      group_by: payload.groupBy,
      column_map: payload.columnMap,
      sync_direction: payload.syncDirection,
      archived_at: payload.archivedAt,
    })
    .eq('id', bindingId)
    .select('*')
    .single();
  if (error) throw error;
  return mapBinding(data as KanbanBindingRow);
}

export async function deleteBinding(bindingId: string, userId: string) {
  const { data: existing } = await supabase.from('kanban_bindings').select('*').eq('id', bindingId).maybeSingle();
  if (!existing) throw new Error('binding_not_found');
  await assertBoardAccess(String((existing as any).board_id), userId, String((existing as any).workspace_id || '') || null);
  await supabase.from('kanban_bindings').update({ archived_at: new Date().toISOString() }).eq('id', bindingId);
  return true;
}

export async function touchBindingSync(bindingId: string, userId: string) {
  const { data: existing } = await supabase.from('kanban_bindings').select('*').eq('id', bindingId).maybeSingle();
  if (!existing) throw new Error('binding_not_found');
  await assertBoardAccess(String((existing as any).board_id), userId, String((existing as any).workspace_id || '') || null);
  const { data, error } = await supabase
    .from('kanban_bindings')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', bindingId)
    .select('*')
    .single();
  if (error) throw error;
  return mapBinding(data as KanbanBindingRow);
}
