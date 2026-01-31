import { supabase } from '../../lib/supabase';
import { applyWorkspaceScope } from '../../lib/workspaceScope';
import type {
  KanbanBoard,
  KanbanBoardSummary,
  KanbanCard,
  KanbanCardLink,
  KanbanComment,
  KanbanLabel,
  KanbanList,
  KanbanMember,
  KanbanTemplate,
  KanbanUserLite,
} from '../../../../shared/kanbanTypes';
import { moveId, reorderByOrderedIds } from './positions';
import { KANBAN_TEMPLATES_BY_ID } from '../../templates/kanbanTemplates';

const USER_SELECT = 'id,email,first_name,last_name,full_name,avatar_url';

type BoardRow = {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  board_type: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type ListRow = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type CardRow = {
  id: string;
  board_id: string;
  list_id: string;
  position: number;
  title: string;
  description: string | null;
  due_at: string | null;
  start_at: string | null;
  cover_color: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type MemberRow = {
  id: string;
  board_id: string;
  member_type: 'user' | 'guest';
  member_id: string;
  role: 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';
  created_at: string;
};

type LabelRow = {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

type LinkRow = {
  id: string;
  card_id: string;
  entity_type: 'lead' | 'candidate' | 'opportunity' | 'table_row';
  entity_id: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  card_id: string;
  author_type: 'user' | 'guest';
  author_id: string;
  body: string;
  created_at: string;
};

function toUserLite(row: any): KanbanUserLite {
  const full = String(row?.full_name || '').trim();
  const composed = [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim();
  return {
    id: String(row?.id || ''),
    email: row?.email ?? null,
    fullName: full || composed || row?.email || null,
    avatarUrl: row?.avatar_url ?? null,
  };
}

async function getBoardRole(boardId: string, userId: string): Promise<MemberRow['role'] | null> {
  const { data } = await supabase
    .from('kanban_board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('member_type', 'user')
    .eq('member_id', userId)
    .maybeSingle();
  return (data as any)?.role ?? null;
}

async function assertBoardRole(boardId: string, userId: string, allowed: MemberRow['role'][]): Promise<void> {
  const role = await getBoardRole(boardId, userId);
  if (!role || !allowed.includes(role)) throw new Error('forbidden');
}

function mapMemberRows(rows: MemberRow[], usersById: Map<string, KanbanUserLite>): KanbanMember[] {
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    memberType: row.member_type,
    memberId: row.member_id,
    role: row.role,
    createdAt: row.created_at,
    user: row.member_type === 'user' ? (usersById.get(row.member_id) || null) : null,
  }));
}

function mapLabelRows(rows: LabelRow[]): KanbanLabel[] {
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    color: row.color ?? null,
    createdAt: row.created_at,
  }));
}

function mapCardRows(rows: CardRow[]): KanbanCard[] {
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    listId: row.list_id,
    position: row.position,
    title: row.title,
    description: row.description ?? null,
    dueAt: row.due_at ?? null,
    startAt: row.start_at ?? null,
    coverColor: row.cover_color ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
    labels: [],
    assignees: [],
    links: [],
    comments: [],
  }));
}

function mapListRows(rows: ListRow[], cards: KanbanCard[]): KanbanList[] {
  const byList = new Map<string, KanbanCard[]>();
  for (const card of cards) {
    const arr = byList.get(card.listId) || [];
    arr.push(card);
    byList.set(card.listId, arr);
  }
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    name: row.name,
    position: row.position,
    color: row.color ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
    cards: (byList.get(row.id) || []).sort((a, b) => a.position - b.position),
  }));
}

async function fetchUsersByIds(ids: string[]): Promise<Map<string, KanbanUserLite>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from('users').select(USER_SELECT).in('id', ids);
  const map = new Map<string, KanbanUserLite>();
  for (const row of data || []) {
    map.set(String((row as any).id), toUserLite(row));
  }
  return map;
}

async function fetchBoardMembers(boardId: string): Promise<KanbanMember[]> {
  const { data } = await supabase
    .from('kanban_board_members')
    .select('id,board_id,member_type,member_id,role,created_at')
    .eq('board_id', boardId);
  const rows = (data || []) as MemberRow[];
  const userIds = rows.filter((r) => r.member_type === 'user').map((r) => r.member_id);
  const usersById = await fetchUsersByIds(userIds);
  return mapMemberRows(rows, usersById);
}

async function fetchBoardMembersForBoards(boardIds: string[]): Promise<Map<string, KanbanMember[]>> {
  if (!boardIds.length) return new Map();
  const { data } = await supabase
    .from('kanban_board_members')
    .select('id,board_id,member_type,member_id,role,created_at')
    .in('board_id', boardIds);
  const rows = (data || []) as MemberRow[];
  const userIds = rows.filter((r) => r.member_type === 'user').map((r) => r.member_id);
  const usersById = await fetchUsersByIds(userIds);
  const byBoard = new Map<string, KanbanMember[]>();
  for (const row of rows) {
    const arr = byBoard.get(row.board_id) || [];
    arr.push({
      id: row.id,
      boardId: row.board_id,
      memberType: row.member_type,
      memberId: row.member_id,
      role: row.role,
      createdAt: row.created_at,
      user: row.member_type === 'user' ? (usersById.get(row.member_id) || null) : null,
    });
    byBoard.set(row.board_id, arr);
  }
  return byBoard;
}

async function fetchBoardIdsForUser(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('kanban_board_members')
    .select('board_id')
    .eq('member_type', 'user')
    .eq('member_id', userId);
  return (data || []).map((row: any) => String(row.board_id));
}

function scopedBoards(workspaceId?: string | null, userId?: string | null) {
  return applyWorkspaceScope(supabase.from('kanban_boards'), {
    workspaceId,
    userId,
    ownerColumn: 'created_by',
  });
}

async function fetchListIdsByBoard(boardId: string): Promise<string[]> {
  const { data } = await supabase
    .from('kanban_lists')
    .select('id')
    .eq('board_id', boardId)
    .is('archived_at', null)
    .order('position', { ascending: true });
  return (data || []).map((row: any) => String(row.id));
}

async function persistListOrder(boardId: string, orderedListIds: string[]): Promise<void> {
  let position = 1;
  for (const listId of orderedListIds) {
    await supabase.from('kanban_lists').update({ position }).eq('id', listId).eq('board_id', boardId);
    position += 1;
  }
}

async function fetchCardIdsByList(listId: string): Promise<string[]> {
  const { data } = await supabase
    .from('kanban_cards')
    .select('id')
    .eq('list_id', listId)
    .is('archived_at', null)
    .order('position', { ascending: true });
  return (data || []).map((row: any) => String(row.id));
}

async function persistCardOrder(listId: string, orderedCardIds: string[]): Promise<void> {
  let position = 1;
  for (const cardId of orderedCardIds) {
    await supabase.from('kanban_cards').update({ list_id: listId, position }).eq('id', cardId);
    position += 1;
  }
}

export async function listBoards(
  userId: string,
  workspaceId?: string | null
): Promise<KanbanBoardSummary[]> {
  const boardIds = await fetchBoardIdsForUser(userId);
  if (!boardIds.length) return [];

  const { data: boards, error } = await scopedBoards(workspaceId, userId)
    .select('id,workspace_id,name,description,board_type,created_by,updated_at,archived_at,created_at')
    .in('id', boardIds)
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message || 'boards_fetch_failed');

  const ids = (boards || []).map((b: any) => String(b.id));
  const [membersByBoard, listRowsResp, cardRowsResp] = await Promise.all([
    fetchBoardMembersForBoards(ids),
    supabase.from('kanban_lists').select('board_id,color').in('board_id', ids).is('archived_at', null),
    supabase.from('kanban_cards').select('board_id').in('board_id', ids).is('archived_at', null),
  ]);

  const listRows = (listRowsResp as any)?.data || [];
  const cardRows = (cardRowsResp as any)?.data || [];
  const colorsByBoard = new Map<string, Set<string>>();
  for (const row of listRows) {
    const boardId = String((row as any).board_id);
    const color = String((row as any).color || '').trim();
    if (!color) continue;
    const set = colorsByBoard.get(boardId) || new Set<string>();
    set.add(color);
    colorsByBoard.set(boardId, set);
  }
  const cardCountByBoard = new Map<string, number>();
  for (const row of cardRows) {
    const boardId = String((row as any).board_id);
    cardCountByBoard.set(boardId, (cardCountByBoard.get(boardId) || 0) + 1);
  }

  return (boards || []).map((row: any) => {
    const boardId = String(row.id);
    const members = membersByBoard.get(boardId) || [];
    const preview = members.slice(0, 5);
    const colors = Array.from(colorsByBoard.get(boardId) || []).slice(0, 6);
    return {
      id: boardId,
      workspaceId: row.workspace_id ?? null,
      name: row.name,
      description: row.description ?? null,
      boardType: row.board_type ?? null,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at ?? null,
      cardCount: cardCountByBoard.get(boardId) || 0,
      memberPreview: preview,
      columnColors: colors,
    };
  });
}

export async function getBoardById(
  boardId: string,
  userId: string,
  workspaceId?: string | null
): Promise<KanbanBoard> {
  const role = await getBoardRole(boardId, userId);
  if (!role) throw new Error('forbidden');

  const { data: board, error } = await scopedBoards(workspaceId, userId)
    .select('id,workspace_id,name,description,board_type,created_by,created_at,updated_at,archived_at')
    .eq('id', boardId)
    .maybeSingle();
  if (error || !board) throw new Error('board_not_found');

  const [listsResp, cardsResp, labelsResp, members] = await Promise.all([
    supabase
      .from('kanban_lists')
      .select('id,board_id,name,position,color,created_by,created_at,updated_at,archived_at')
      .eq('board_id', boardId)
      .is('archived_at', null)
      .order('position', { ascending: true }),
    supabase
      .from('kanban_cards')
      .select('id,board_id,list_id,position,title,description,due_at,start_at,cover_color,created_by,created_at,updated_at,archived_at')
      .eq('board_id', boardId)
      .is('archived_at', null)
      .order('position', { ascending: true }),
    supabase.from('kanban_labels').select('id,board_id,name,color,created_at').eq('board_id', boardId),
    fetchBoardMembers(boardId),
  ]);

  const listRows = (listsResp as any)?.data || [];
  const cardRows = (cardsResp as any)?.data || [];
  const labelRows = (labelsResp as any)?.data || [];

  const lists = mapListRows(listRows as ListRow[], mapCardRows(cardRows as CardRow[]));
  const labels = mapLabelRows(labelRows as LabelRow[]);

  return {
    id: String(board.id),
    workspaceId: (board as any).workspace_id ?? null,
    name: (board as any).name,
    description: (board as any).description ?? null,
    boardType: (board as any).board_type ?? null,
    createdBy: (board as any).created_by,
    createdAt: (board as any).created_at,
    updatedAt: (board as any).updated_at,
    archivedAt: (board as any).archived_at ?? null,
    lists,
    labels,
    members,
  };
}

export async function createBoard(
  userId: string,
  input: { workspaceId?: string | null; name: string; description?: string | null; boardType?: string | null }
): Promise<KanbanBoard> {
  const { data, error } = await supabase
    .from('kanban_boards')
    .insert({
      workspace_id: input.workspaceId || null,
      name: input.name,
      description: input.description ?? null,
      board_type: input.boardType ?? null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error || !data?.id) throw new Error(error?.message || 'board_create_failed');

  await supabase.from('kanban_board_members').insert({
    board_id: data.id,
    member_type: 'user',
    member_id: userId,
    role: 'owner',
  });

  return getBoardById(String(data.id), userId, input.workspaceId || null);
}

export async function updateBoard(
  boardId: string,
  userId: string,
  input: { name?: string; description?: string | null; boardType?: string | null; archived?: boolean }
): Promise<KanbanBoard> {
  await assertBoardRole(boardId, userId, ['owner', 'admin', 'editor']);
  const patch: any = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.boardType !== undefined) patch.board_type = input.boardType;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;

  const { error } = await supabase.from('kanban_boards').update(patch).eq('id', boardId);
  if (error) throw new Error(error.message || 'board_update_failed');

  return getBoardById(boardId, userId);
}

export async function archiveBoard(boardId: string, userId: string): Promise<void> {
  await assertBoardRole(boardId, userId, ['owner', 'admin', 'editor']);
  const { error } = await supabase
    .from('kanban_boards')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', boardId);
  if (error) throw new Error(error.message || 'board_archive_failed');
}

export async function createBoardFromTemplate(
  userId: string,
  input: { workspaceId?: string | null; templateId: string; boardName?: string }
): Promise<KanbanBoard> {
  const template = KANBAN_TEMPLATES_BY_ID.get(input.templateId);
  if (!template) throw new Error('template_not_found');

  const board = await createBoard(userId, {
    workspaceId: input.workspaceId || null,
    name: input.boardName || template.name,
    description: null,
    boardType: template.boardType,
  });

  const listRows = template.lists.map((l) => ({
    board_id: board.id,
    name: l.name,
    position: l.position,
    color: l.color ?? null,
    created_by: userId,
  }));
  if (listRows.length) {
    await supabase.from('kanban_lists').insert(listRows);
  }

  const labelRows = (template.labels || []).map((l) => ({
    board_id: board.id,
    name: l.name,
    color: l.color ?? null,
  }));
  if (labelRows.length) {
    await supabase.from('kanban_labels').insert(labelRows);
  }

  return getBoardById(board.id, userId, input.workspaceId || null);
}

export async function createList(
  boardId: string,
  userId: string,
  input: { name: string; position?: number; color?: string | null }
): Promise<KanbanList[]> {
  await assertBoardRole(boardId, userId, ['owner', 'admin', 'editor']);

  const { data: listRow, error } = await supabase
    .from('kanban_lists')
    .insert({
      board_id: boardId,
      name: input.name,
      position: 9999,
      color: input.color ?? null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error || !listRow?.id) throw new Error(error?.message || 'list_create_failed');

  const listIds = await fetchListIdsByBoard(boardId);
  const desired = input.position ?? listIds.length - 1;
  const ordered = moveId(listIds, String(listRow.id), desired);
  await persistListOrder(boardId, ordered);

  const { data: lists } = await supabase
    .from('kanban_lists')
    .select('id,board_id,name,position,color,created_by,created_at,updated_at,archived_at')
    .eq('board_id', boardId)
    .is('archived_at', null)
    .order('position', { ascending: true });
  return mapListRows((lists || []) as ListRow[], []);
}

export async function updateList(
  listId: string,
  userId: string,
  input: { name?: string; color?: string | null; archived?: boolean }
): Promise<KanbanList> {
  const { data: list } = await supabase
    .from('kanban_lists')
    .select('board_id')
    .eq('id', listId)
    .maybeSingle();
  if (!list?.board_id) throw new Error('list_not_found');
  await assertBoardRole(String(list.board_id), userId, ['owner', 'admin', 'editor']);

  const patch: any = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('kanban_lists')
    .update(patch)
    .eq('id', listId)
    .select('id,board_id,name,position,color,created_by,created_at,updated_at,archived_at')
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || 'list_update_failed');

  return mapListRows([data as ListRow], [])[0];
}

export async function reorderList(
  listId: string,
  userId: string,
  toIndex: number
): Promise<KanbanList[]> {
  const { data: list } = await supabase.from('kanban_lists').select('board_id').eq('id', listId).maybeSingle();
  if (!list?.board_id) throw new Error('list_not_found');
  await assertBoardRole(String(list.board_id), userId, ['owner', 'admin', 'editor']);

  const listIds = await fetchListIdsByBoard(String(list.board_id));
  const ordered = moveId(listIds, listId, toIndex);
  await persistListOrder(String(list.board_id), ordered);

  const { data: lists } = await supabase
    .from('kanban_lists')
    .select('id,board_id,name,position,color,created_by,created_at,updated_at,archived_at')
    .eq('board_id', list.board_id)
    .is('archived_at', null)
    .order('position', { ascending: true });
  return mapListRows((lists || []) as ListRow[], []);
}

export async function archiveList(listId: string, userId: string): Promise<void> {
  const { data: list } = await supabase.from('kanban_lists').select('board_id').eq('id', listId).maybeSingle();
  if (!list?.board_id) throw new Error('list_not_found');
  await assertBoardRole(String(list.board_id), userId, ['owner', 'admin', 'editor']);
  const { error } = await supabase
    .from('kanban_lists')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', listId);
  if (error) throw new Error(error.message || 'list_archive_failed');
}

export async function createCard(
  listId: string,
  userId: string,
  input: {
    title: string;
    description?: string | null;
    position?: number;
    dueAt?: string | null;
    startAt?: string | null;
    coverColor?: string | null;
  }
): Promise<KanbanCard[]> {
  const { data: list } = await supabase.from('kanban_lists').select('board_id').eq('id', listId).maybeSingle();
  if (!list?.board_id) throw new Error('list_not_found');
  await assertBoardRole(String(list.board_id), userId, ['owner', 'admin', 'editor']);

  const { data: cardRow, error } = await supabase
    .from('kanban_cards')
    .insert({
      board_id: list.board_id,
      list_id: listId,
      position: 9999,
      title: input.title,
      description: input.description ?? null,
      due_at: input.dueAt ?? null,
      start_at: input.startAt ?? null,
      cover_color: input.coverColor ?? null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error || !cardRow?.id) throw new Error(error?.message || 'card_create_failed');

  const cardIds = await fetchCardIdsByList(listId);
  const desired = input.position ?? cardIds.length - 1;
  const ordered = moveId(cardIds, String(cardRow.id), desired);
  await persistCardOrder(listId, ordered);

  const { data: cards } = await supabase
    .from('kanban_cards')
    .select('id,board_id,list_id,position,title,description,due_at,start_at,cover_color,created_by,created_at,updated_at,archived_at')
    .eq('list_id', listId)
    .is('archived_at', null)
    .order('position', { ascending: true });
  return mapCardRows((cards || []) as CardRow[]);
}

export async function updateCard(
  cardId: string,
  userId: string,
  input: { title?: string; description?: string | null; dueAt?: string | null; startAt?: string | null; coverColor?: string | null; archived?: boolean }
): Promise<KanbanCard> {
  const { data: card } = await supabase.from('kanban_cards').select('board_id').eq('id', cardId).maybeSingle();
  if (!card?.board_id) throw new Error('card_not_found');
  await assertBoardRole(String(card.board_id), userId, ['owner', 'admin', 'editor']);

  const patch: any = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.startAt !== undefined) patch.start_at = input.startAt;
  if (input.coverColor !== undefined) patch.cover_color = input.coverColor;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('kanban_cards')
    .update(patch)
    .eq('id', cardId)
    .select('id,board_id,list_id,position,title,description,due_at,start_at,cover_color,created_by,created_at,updated_at,archived_at')
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || 'card_update_failed');
  return mapCardRows([data as CardRow])[0];
}

export async function moveCard(
  cardId: string,
  userId: string,
  input: { fromListId: string; toListId: string; toIndex: number }
): Promise<{ lists: Array<{ id: string; cards: KanbanCard[] }> }> {
  const { data: card } = await supabase
    .from('kanban_cards')
    .select('id,board_id,list_id')
    .eq('id', cardId)
    .maybeSingle();
  if (!card?.id) throw new Error('card_not_found');
  await assertBoardRole(String(card.board_id), userId, ['owner', 'admin', 'editor']);
  if (String(card.list_id) !== input.fromListId) throw new Error('card_list_mismatch');

  const fromIds = await fetchCardIdsByList(input.fromListId);
  const toIds = input.fromListId === input.toListId ? fromIds : await fetchCardIdsByList(input.toListId);

  const nextFrom = fromIds.filter((id) => id !== cardId);
  const nextTo = moveId(toIds.filter((id) => id !== cardId), cardId, input.toIndex);

  if (input.fromListId === input.toListId) {
    await persistCardOrder(input.toListId, nextTo);
  } else {
    await persistCardOrder(input.fromListId, nextFrom);
    await persistCardOrder(input.toListId, nextTo);
  }

  const [fromCardsResp, toCardsResp] = await Promise.all([
    supabase
      .from('kanban_cards')
      .select('id,board_id,list_id,position,title,description,due_at,start_at,cover_color,created_by,created_at,updated_at,archived_at')
      .eq('list_id', input.fromListId)
      .is('archived_at', null)
      .order('position', { ascending: true }),
    supabase
      .from('kanban_cards')
      .select('id,board_id,list_id,position,title,description,due_at,start_at,cover_color,created_by,created_at,updated_at,archived_at')
      .eq('list_id', input.toListId)
      .is('archived_at', null)
      .order('position', { ascending: true }),
  ]);

  return {
    lists: [
      { id: input.fromListId, cards: mapCardRows(((fromCardsResp as any)?.data || []) as CardRow[]) },
      { id: input.toListId, cards: mapCardRows(((toCardsResp as any)?.data || []) as CardRow[]) },
    ],
  };
}

export async function reorderCards(
  listId: string,
  userId: string,
  orderedCardIds: string[]
): Promise<{ listId: string; cards: KanbanCard[] }> {
  const { data: list } = await supabase.from('kanban_lists').select('board_id').eq('id', listId).maybeSingle();
  if (!list?.board_id) throw new Error('list_not_found');
  await assertBoardRole(String(list.board_id), userId, ['owner', 'admin', 'editor']);

  const existing = await fetchCardIdsByList(listId);
  const next = reorderByOrderedIds(existing, orderedCardIds);
  await persistCardOrder(listId, next);

  const { data } = await supabase
    .from('kanban_cards')
    .select('id,board_id,list_id,position,title,description,due_at,start_at,cover_color,created_by,created_at,updated_at,archived_at')
    .eq('list_id', listId)
    .is('archived_at', null)
    .order('position', { ascending: true });
  return { listId, cards: mapCardRows((data || []) as CardRow[]) };
}

export async function archiveCard(cardId: string, userId: string): Promise<void> {
  const { data: card } = await supabase.from('kanban_cards').select('board_id').eq('id', cardId).maybeSingle();
  if (!card?.board_id) throw new Error('card_not_found');
  await assertBoardRole(String(card.board_id), userId, ['owner', 'admin', 'editor']);
  const { error } = await supabase
    .from('kanban_cards')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', cardId);
  if (error) throw new Error(error.message || 'card_archive_failed');
}

export async function listBoardMembers(boardId: string, userId: string): Promise<KanbanMember[]> {
  const role = await getBoardRole(boardId, userId);
  if (!role) throw new Error('forbidden');
  return fetchBoardMembers(boardId);
}

export async function addBoardMember(
  boardId: string,
  userId: string,
  input: { memberType: 'user' | 'guest'; memberId?: string; email?: string; role: MemberRow['role'] }
): Promise<KanbanMember> {
  await assertBoardRole(boardId, userId, ['owner', 'admin']);

  let memberType = input.memberType;
  let memberId = input.memberId || '';

  if (!memberId && input.email) {
    const { data } = await supabase.from('users').select(USER_SELECT).ilike('email', input.email).maybeSingle();
    if (data?.id) {
      memberType = 'user';
      memberId = String((data as any).id);
    }
  }

  if (!memberId) {
    throw new Error('member_not_found');
  }

  const { data: row, error } = await supabase
    .from('kanban_board_members')
    .upsert(
      {
        board_id: boardId,
        member_type: memberType,
        member_id: memberId,
        role: input.role,
      },
      { onConflict: 'board_id,member_type,member_id' }
    )
    .select('id,board_id,member_type,member_id,role,created_at')
    .single();
  if (error || !row) throw new Error(error?.message || 'member_add_failed');

  const usersById = memberType === 'user' ? await fetchUsersByIds([memberId]) : new Map();
  return mapMemberRows([row as MemberRow], usersById)[0];
}

export async function updateBoardMemberRole(
  boardId: string,
  userId: string,
  memberId: string,
  memberType: 'user' | 'guest',
  role: MemberRow['role']
): Promise<KanbanMember> {
  await assertBoardRole(boardId, userId, ['owner', 'admin']);
  const { data, error } = await supabase
    .from('kanban_board_members')
    .update({ role })
    .eq('board_id', boardId)
    .eq('member_type', memberType)
    .eq('member_id', memberId)
    .select('id,board_id,member_type,member_id,role,created_at')
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || 'member_update_failed');
  const usersById = memberType === 'user' ? await fetchUsersByIds([memberId]) : new Map();
  return mapMemberRows([data as MemberRow], usersById)[0];
}

export async function removeBoardMember(
  boardId: string,
  userId: string,
  memberId: string,
  memberType: 'user' | 'guest'
): Promise<void> {
  await assertBoardRole(boardId, userId, ['owner', 'admin']);
  const { error } = await supabase
    .from('kanban_board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('member_type', memberType)
    .eq('member_id', memberId);
  if (error) throw new Error(error.message || 'member_remove_failed');
}

export async function addCardLink(
  cardId: string,
  userId: string,
  input: { entityType: LinkRow['entity_type']; entityId: string }
): Promise<KanbanCardLink> {
  const { data: card } = await supabase.from('kanban_cards').select('board_id').eq('id', cardId).maybeSingle();
  if (!card?.board_id) throw new Error('card_not_found');
  await assertBoardRole(String(card.board_id), userId, ['owner', 'admin', 'editor']);

  const { data, error } = await supabase
    .from('kanban_card_links')
    .insert({
      card_id: cardId,
      entity_type: input.entityType,
      entity_id: input.entityId,
    })
    .select('id,card_id,entity_type,entity_id,created_at')
    .single();
  if (error || !data) throw new Error(error?.message || 'link_add_failed');

  return {
    id: String((data as any).id),
    cardId: String((data as any).card_id),
    entityType: (data as any).entity_type,
    entityId: String((data as any).entity_id),
    createdAt: (data as any).created_at,
  };
}

export async function removeCardLink(cardId: string, userId: string, linkId: string): Promise<void> {
  const { data: card } = await supabase.from('kanban_cards').select('board_id').eq('id', cardId).maybeSingle();
  if (!card?.board_id) throw new Error('card_not_found');
  await assertBoardRole(String(card.board_id), userId, ['owner', 'admin', 'editor']);

  const { error } = await supabase.from('kanban_card_links').delete().eq('id', linkId).eq('card_id', cardId);
  if (error) throw new Error(error.message || 'link_remove_failed');
}

export async function listCardComments(cardId: string, userId: string): Promise<KanbanComment[]> {
  const { data: card } = await supabase.from('kanban_cards').select('board_id').eq('id', cardId).maybeSingle();
  if (!card?.board_id) throw new Error('card_not_found');
  const role = await getBoardRole(String(card.board_id), userId);
  if (!role) throw new Error('forbidden');

  const { data } = await supabase
    .from('kanban_comments')
    .select('id,card_id,author_type,author_id,body,created_at')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });
  const rows = (data || []) as CommentRow[];
  const userIds = rows.filter((r) => r.author_type === 'user').map((r) => r.author_id);
  const usersById = await fetchUsersByIds(userIds);

  return rows.map((row) => ({
    id: row.id,
    cardId: row.card_id,
    authorType: row.author_type,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    author: row.author_type === 'user' ? (usersById.get(row.author_id) || null) : null,
  }));
}

export async function addCardComment(cardId: string, userId: string, body: string): Promise<KanbanComment> {
  const { data: card } = await supabase.from('kanban_cards').select('board_id').eq('id', cardId).maybeSingle();
  if (!card?.board_id) throw new Error('card_not_found');
  await assertBoardRole(String(card.board_id), userId, ['owner', 'admin', 'editor', 'commenter']);

  const { data, error } = await supabase
    .from('kanban_comments')
    .insert({
      card_id: cardId,
      author_type: 'user',
      author_id: userId,
      body,
    })
    .select('id,card_id,author_type,author_id,body,created_at')
    .single();
  if (error || !data) throw new Error(error?.message || 'comment_add_failed');

  const usersById = await fetchUsersByIds([userId]);
  return {
    id: String((data as any).id),
    cardId: String((data as any).card_id),
    authorType: (data as any).author_type,
    authorId: String((data as any).author_id),
    body: (data as any).body,
    createdAt: (data as any).created_at,
    author: usersById.get(userId) || null,
  };
}

export function listTemplates(): KanbanTemplate[] {
  return Array.from(KANBAN_TEMPLATES_BY_ID.values());
}

