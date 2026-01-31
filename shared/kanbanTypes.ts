export type KanbanMemberRole = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';
export type KanbanMemberType = 'user' | 'guest';
export type KanbanAssigneeType = 'user' | 'guest';
export type KanbanEntityType = 'lead' | 'candidate' | 'opportunity' | 'table_row';

export type KanbanUserLite = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

export type KanbanMember = {
  id: string;
  boardId: string;
  memberType: KanbanMemberType;
  memberId: string;
  role: KanbanMemberRole;
  createdAt: string;
  user?: KanbanUserLite | null;
  email?: string | null;
};

export type KanbanLabel = {
  id: string;
  boardId: string;
  name: string;
  color?: string | null;
  createdAt: string;
};

export type KanbanCardLink = {
  id: string;
  cardId: string;
  entityType: KanbanEntityType;
  entityId: string;
  createdAt: string;
};

export type KanbanComment = {
  id: string;
  cardId: string;
  authorType: KanbanAssigneeType;
  authorId: string;
  body: string;
  createdAt: string;
  author?: KanbanUserLite | null;
};

export type KanbanCard = {
  id: string;
  boardId: string;
  listId: string;
  position: number;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  startAt?: string | null;
  coverColor?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  labels?: KanbanLabel[];
  assignees?: KanbanMember[];
  links?: KanbanCardLink[];
  comments?: KanbanComment[];
};

export type KanbanList = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  cards: KanbanCard[];
};

export type KanbanBoardSummary = {
  id: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  boardType?: string | null;
  updatedAt: string;
  archivedAt?: string | null;
  cardCount: number;
  memberPreview: KanbanMember[];
  columnColors: string[];
};

export type KanbanBoard = {
  id: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  boardType?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  lists: KanbanList[];
  labels: KanbanLabel[];
  members: KanbanMember[];
};

export type KanbanTemplate = {
  id: string;
  name: string;
  boardType: string;
  lists: Array<{
    name: string;
    color?: string | null;
    position: number;
  }>;
  labels?: Array<{
    name: string;
    color?: string | null;
  }>;
};

