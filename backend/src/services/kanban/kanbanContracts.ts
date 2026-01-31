export type KanbanMoveRequest = {
  cardId: string;
  fromListId: string;
  toListId: string;
  toIndex: number;
};

export type KanbanMoveResponse = {
  lists: Array<{
    id: string;
    cards: Array<{
      id: string;
      listId: string;
      position: number;
    }>;
  }>;
};

export type KanbanReorderRequest = {
  listId: string;
  orderedCardIds: string[];
};

export type KanbanReorderResponse = {
  listId: string;
  cards: Array<{
    id: string;
    listId: string;
    position: number;
  }>;
};

export const KANBAN_MOVE_CONFLICT_STRATEGY = {
  optimisticUiAllowed: true,
  serverReturnsCanonicalPositions: true,
};

