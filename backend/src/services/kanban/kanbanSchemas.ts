import { z } from 'zod';

export const createBoardSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  boardType: z.string().optional().nullable(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  boardType: z.string().optional().nullable(),
  archived: z.boolean().optional(),
});

export const boardFromTemplateSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  templateId: z.string().min(1),
  boardName: z.string().optional(),
});

export const createListSchema = z.object({
  name: z.string().min(1),
  position: z.number().int().min(0).optional(),
  color: z.string().optional().nullable(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional().nullable(),
  archived: z.boolean().optional(),
});

export const reorderListSchema = z.object({
  toIndex: z.number().int().min(0),
});

export const createCardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  coverColor: z.string().optional().nullable(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  coverColor: z.string().optional().nullable(),
  archived: z.boolean().optional(),
});

export const moveCardSchema = z.object({
  fromListId: z.string().uuid(),
  toListId: z.string().uuid(),
  toIndex: z.number().int().min(0),
  cardId: z.string().uuid().optional(),
});

export const reorderCardsSchema = z.object({
  listId: z.string().uuid(),
  orderedCardIds: z.array(z.string().uuid()).min(1),
});

export const addMemberSchema = z.object({
  memberType: z.enum(['user', 'guest']).default('user'),
  memberId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(['owner', 'admin', 'editor', 'commenter', 'viewer']).default('viewer'),
});

export const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'editor', 'commenter', 'viewer']),
  memberType: z.enum(['user', 'guest']).default('user'),
});

export const addLinkSchema = z.object({
  entityType: z.enum(['lead', 'candidate', 'opportunity', 'table_row']),
  entityId: z.string().uuid(),
});

export const addCommentSchema = z.object({
  body: z.string().min(1),
});

