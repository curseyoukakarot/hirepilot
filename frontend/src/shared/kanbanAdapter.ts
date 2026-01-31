import type { KanbanBoard, KanbanBoardSummary, KanbanTemplate } from './kanbanTypes';

export const MOCK_KANBAN_BOARD_SUMMARY: KanbanBoardSummary = {
  id: 'board_mock_1',
  workspaceId: 'workspace_mock_1',
  name: 'Recruiting Pipeline',
  description: 'Example board summary',
  boardType: 'recruiting_pipeline',
  updatedAt: new Date().toISOString(),
  archivedAt: null,
  cardCount: 12,
  memberPreview: [],
  columnColors: ['#38bdf8', '#818cf8', '#22c55e'],
};

export const MOCK_KANBAN_TEMPLATES: KanbanTemplate[] = [
  {
    id: 'recruiting_pipeline',
    name: 'Recruiting Pipeline',
    boardType: 'recruiting_pipeline',
    lists: [
      { name: 'New Lead', color: '#38bdf8', position: 1 },
      { name: 'Interview', color: '#f97316', position: 2 },
    ],
    labels: [{ name: 'Qualified', color: '#22c55e' }],
  },
];

export function mapKanbanBoardToViewModel(board: KanbanBoard) {
  return {
    boardId: board.id,
    title: board.name,
    description: board.description ?? '',
    lists: board.lists.map((list) => ({
      id: list.id,
      name: list.name,
      color: list.color ?? undefined,
      cards: list.cards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description ?? '',
        dueAt: card.dueAt ?? null,
        startAt: card.startAt ?? null,
        coverColor: card.coverColor ?? null,
      })),
    })),
  };
}

