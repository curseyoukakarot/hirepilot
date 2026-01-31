import { supabase } from '../../lib/supabase';
import type { KanbanCard, KanbanLabel } from '../../../../shared/kanbanTypes';
import { getBoardById } from './kanbanService';

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
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type LabelRow = {
  id: string;
  board_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

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

export async function listBoardCards(
  boardId: string,
  userId: string,
  workspaceId: string | null,
  options: {
    columnId?: string | null;
    query?: string | null;
    assigneeId?: string | null;
    label?: string | null;
    updatedAfter?: string | null;
    page?: number;
    pageSize?: number;
  }
) {
  await getBoardById(boardId, userId, workspaceId);

  let query = supabase
    .from('kanban_cards')
    .select('*')
    .eq('board_id', boardId)
    .is('archived_at', null);

  if (options.columnId) query = query.eq('list_id', options.columnId);
  if (options.query) query = query.ilike('title', `%${options.query}%`);
  if (options.updatedAfter) query = query.gte('updated_at', options.updatedAfter);

  if (options.assigneeId) {
    const { data: assigneeRows } = await supabase
      .from('kanban_card_assignees')
      .select('card_id')
      .eq('assignee_id', options.assigneeId);
    const cardIds = (assigneeRows || []).map((row: any) => String(row.card_id));
    if (!cardIds.length) return { cards: [], page: options.page || 1, pageSize: options.pageSize || 50 };
    query = query.in('id', cardIds);
  }

  if (options.label) {
    const { data: labelRows } = await supabase
      .from('kanban_labels')
      .select('id')
      .eq('board_id', boardId)
      .or(`id.eq.${options.label},name.eq.${options.label}`);
    const labelIds = (labelRows || []).map((row: any) => String(row.id));
    if (!labelIds.length) return { cards: [], page: options.page || 1, pageSize: options.pageSize || 50 };
    const { data: cardLabelRows } = await supabase
      .from('kanban_card_labels')
      .select('card_id')
      .in('label_id', labelIds);
    const cardIds = (cardLabelRows || []).map((row: any) => String(row.card_id));
    if (!cardIds.length) return { cards: [], page: options.page || 1, pageSize: options.pageSize || 50 };
    query = query.in('id', cardIds);
  }

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: cardsRows } = await query.order('position', { ascending: true }).range(from, to);
  const cards = mapCardRows((cardsRows || []) as CardRow[]);

  if (!cards.length) return { cards, page, pageSize };

  const cardIds = cards.map((card) => card.id);
  const [labelsRes, cardLabelRes, commentsRes] = await Promise.all([
    supabase.from('kanban_labels').select('id,board_id,name,color,created_at').eq('board_id', boardId),
    supabase.from('kanban_card_labels').select('card_id,label_id').in('card_id', cardIds),
    supabase.from('kanban_comments').select('id,card_id').in('card_id', cardIds),
  ]);

  const labels = mapLabelRows((labelsRes.data || []) as LabelRow[]);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const labelsByCard = new Map<string, KanbanLabel[]>();
  for (const row of cardLabelRes.data || []) {
    const cardId = String((row as any).card_id);
    const labelId = String((row as any).label_id);
    const label = labelsById.get(labelId);
    if (!label) continue;
    const arr = labelsByCard.get(cardId) || [];
    arr.push(label);
    labelsByCard.set(cardId, arr);
  }

  const commentsByCard = new Map<string, number>();
  for (const row of commentsRes.data || []) {
    const cardId = String((row as any).card_id);
    commentsByCard.set(cardId, (commentsByCard.get(cardId) || 0) + 1);
  }

  for (const card of cards) {
    card.labels = labelsByCard.get(card.id) || [];
    card.comments = Array(commentsByCard.get(card.id) || 0).fill(null) as any;
  }

  return { cards, page, pageSize };
}

export async function getCardById(
  cardId: string,
  userId: string,
  workspaceId: string | null
): Promise<KanbanCard | null> {
  const { data: cardRow } = await supabase.from('kanban_cards').select('*').eq('id', cardId).maybeSingle();
  if (!cardRow) return null;
  await getBoardById(String((cardRow as any).board_id), userId, workspaceId);

  const card = mapCardRows([(cardRow as CardRow)])[0];
  const [labelsRes, cardLabelRes, commentsRes] = await Promise.all([
    supabase.from('kanban_labels').select('id,board_id,name,color,created_at').eq('board_id', card.boardId),
    supabase.from('kanban_card_labels').select('card_id,label_id').eq('card_id', card.id),
    supabase.from('kanban_comments').select('id,card_id').eq('card_id', card.id),
  ]);
  const labels = mapLabelRows((labelsRes.data || []) as LabelRow[]);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  card.labels = (cardLabelRes.data || [])
    .map((row: any) => labelsById.get(String(row.label_id)))
    .filter(Boolean) as KanbanLabel[];
  card.comments = Array((commentsRes.data || []).length).fill(null) as any;
  return card;
}
