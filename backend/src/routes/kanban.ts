import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { supabase } from '../lib/supabase';
import {
  addBoardMember,
  addCardComment,
  addCardLink,
  addChecklistItem,
  archiveBoard,
  archiveCard,
  archiveList,
  createBoard,
  createBoardFromTemplate,
  createCard,
  createList,
  getBoardById,
  listCardLinks,
  listBoardMembers,
  listBoards,
  listCardComments,
  listChecklistItems,
  listTemplates,
  moveCard,
  removeBoardMember,
  removeChecklistItem,
  removeCardLink,
  reorderCards,
  reorderList,
  updateBoard,
  updateBoardMemberRole,
  updateCard,
  updateChecklistItem,
  updateList,
} from '../services/kanban/kanbanService';
import { sendKanbanExistingUserEmail, sendKanbanGuestInviteEmail } from '../../services/emailService';
import {
  addCommentSchema,
  addLinkSchema,
  addMemberSchema,
  boardFromTemplateSchema,
  createBoardSchema,
  createCardSchema,
  createListSchema,
  moveCardSchema,
  reorderCardsSchema,
  reorderListSchema,
  updateBoardSchema,
  updateCardSchema,
  updateListSchema,
  updateMemberSchema,
} from '../services/kanban/kanbanSchemas';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

function resolveWorkspaceId(req: Request): string | null {
  const fromQuery = String((req.query as any)?.workspaceId || '').trim();
  const fromCtx = String((req as any).workspaceId || '').trim();
  return (fromQuery || fromCtx) || null;
}

async function assertGuestInviteAllowed(workspaceId: string | null): Promise<void> {
  if (!workspaceId) throw new Error('guest_invite_requires_workspace');
  const { data } = await supabase.from('workspaces').select('plan').eq('id', workspaceId).maybeSingle();
  const plan = String((data as any)?.plan || '').toLowerCase();
  if (!['team', 'pro'].includes(plan)) throw new Error('guest_invites_not_allowed');
}

// Boards
router.get('/boards', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = resolveWorkspaceId(req);
    const boards = await listBoards(userId, workspaceId);
    return res.json({ boards });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'boards_fetch_failed' });
  }
});

router.get('/boards/templates', async (_req: Request, res: Response) => {
  return res.json({ templates: listTemplates() });
});

router.post('/boards', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = createBoardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const board = await createBoard(userId, {
      workspaceId: parsed.data.workspaceId || resolveWorkspaceId(req),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      boardType: parsed.data.boardType ?? null,
    });
    return res.status(201).json({ board });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'board_create_failed' });
  }
});

router.post('/boards/from-template', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = boardFromTemplateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const board = await createBoardFromTemplate(userId, {
      workspaceId: parsed.data.workspaceId || resolveWorkspaceId(req),
      templateId: parsed.data.templateId,
      boardName: parsed.data.boardName,
    });
    return res.status(201).json({ board });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'board_create_failed' });
  }
});

router.get('/boards/:boardId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const board = await getBoardById(req.params.boardId, userId, resolveWorkspaceId(req));
    return res.json({ board });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 404;
    return res.status(code).json({ error: e?.message || 'board_fetch_failed' });
  }
});

router.patch('/boards/:boardId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateBoardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const board = await updateBoard(req.params.boardId, userId, {
      name: parsed.data.name,
      description: parsed.data.description,
      boardType: parsed.data.boardType,
      archived: parsed.data.archived,
    });
    return res.json({ board });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'board_update_failed' });
  }
});

router.delete('/boards/:boardId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await archiveBoard(req.params.boardId, userId);
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'board_archive_failed' });
  }
});

// Lists
router.post('/boards/:boardId/lists', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = createListSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const lists = await createList(req.params.boardId, userId, {
      name: parsed.data.name,
      position: parsed.data.position,
      color: parsed.data.color ?? null,
    });
    return res.status(201).json({ lists });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'list_create_failed' });
  }
});

router.patch('/lists/:listId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateListSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const list = await updateList(req.params.listId, userId, parsed.data);
    return res.json({ list });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'list_update_failed' });
  }
});

router.post('/lists/:listId/reorder', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = reorderListSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const lists = await reorderList(req.params.listId, userId, parsed.data.toIndex);
    return res.json({ lists });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'list_reorder_failed' });
  }
});

router.delete('/lists/:listId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await archiveList(req.params.listId, userId);
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'list_archive_failed' });
  }
});

// Cards
router.post('/lists/:listId/cards', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = createCardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const cards = await createCard(req.params.listId, userId, parsed.data);
    return res.status(201).json({ cards });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'card_create_failed' });
  }
});

router.patch('/cards/:cardId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateCardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const card = await updateCard(req.params.cardId, userId, parsed.data);
    return res.json({ card });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'card_update_failed' });
  }
});

router.post('/cards/:cardId/move', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = moveCardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const result = await moveCard(req.params.cardId, userId, {
      fromListId: parsed.data.fromListId,
      toListId: parsed.data.toListId,
      toIndex: parsed.data.toIndex,
    });
    return res.json(result);
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'card_move_failed' });
  }
});

router.post('/cards/:cardId/reorder', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = reorderCardsSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const result = await reorderCards(parsed.data.listId, userId, parsed.data.orderedCardIds);
    return res.json(result);
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'card_reorder_failed' });
  }
});

router.delete('/cards/:cardId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await archiveCard(req.params.cardId, userId);
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'card_archive_failed' });
  }
});

// Members
router.get('/boards/:boardId/members', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const members = await listBoardMembers(req.params.boardId, userId);
    return res.json({ members });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'members_fetch_failed' });
  }
});

router.post('/boards/:boardId/invites', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'viewer').toLowerCase();
    if (!email) return res.status(400).json({ error: 'missing_email' });
    const allowedRoles = ['viewer', 'commenter', 'editor', 'admin', 'owner'];
    if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'invalid_role' });

    const appUrl = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.thehirepilot.com').replace(/\/$/, '');
    const boardUrl = `${appUrl}/kanban/${req.params.boardId}`;
    const { data: boardRow } = await supabase.from('kanban_boards').select('name').eq('id', req.params.boardId).maybeSingle();
    const boardName = String((boardRow as any)?.name || 'Untitled Board');
    const { data: inviter } = await supabase
      .from('users')
      .select('first_name,last_name,email')
      .eq('id', userId)
      .maybeSingle();
    const inviterName = `${(inviter as any)?.first_name || ''} ${(inviter as any)?.last_name || ''}`.trim() || String((inviter as any)?.email || '').trim() || 'HirePilot';
    const inviterEmail = String((inviter as any)?.email || '').trim() || 'noreply@hirepilot.com';

    const { data: existingUser } = await supabase.from('users').select('id,email').ilike('email', email).maybeSingle();
    if (existingUser?.id) {
      const member = await addBoardMember(req.params.boardId, userId, {
        memberType: 'user',
        memberId: String(existingUser.id),
        role: role as any,
      });
      try {
        await sendKanbanExistingUserEmail({
          to: String((existingUser as any)?.email || email),
          boardName,
          boardUrl,
          invitedBy: { name: inviterName, email: inviterEmail },
          role,
        });
      } catch (emailErr) {
        console.warn('[kanban] failed to send existing-user email', emailErr);
      }
      return res.status(201).json({ member, status: 'member_added' });
    }

    const { data: roleRow } = await supabase
      .from('kanban_board_members')
      .select('role')
      .eq('board_id', req.params.boardId)
      .eq('member_type', 'user')
      .eq('member_id', userId)
      .maybeSingle();
    const memberRole = String((roleRow as any)?.role || '');
    if (!memberRole || !['owner', 'admin'].includes(memberRole)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    await assertGuestInviteAllowed(resolveWorkspaceId(req));
    const { data: invite, error } = await supabase
      .from('kanban_board_invites')
      .insert({
        board_id: req.params.boardId,
        email,
        role,
        invited_by: userId,
      })
      .select('*')
      .single();
    if (error) throw error;
    try {
      await sendKanbanGuestInviteEmail({
        to: email,
        boardName,
        boardUrl,
        invitedBy: { name: inviterName, email: inviterEmail },
        role,
      });
    } catch (emailErr) {
      console.warn('[kanban] failed to send guest invite email', emailErr);
    }
    return res.status(201).json({ invite, status: 'invited' });
  } catch (e: any) {
    const code = e?.message === 'forbidden' || e?.message === 'guest_invites_not_allowed' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'invite_create_failed' });
  }
});

router.post('/boards/:boardId/members', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = addMemberSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    if (parsed.data.memberType === 'guest') {
      await assertGuestInviteAllowed(resolveWorkspaceId(req));
    }
    const member = await addBoardMember(req.params.boardId, userId, parsed.data);
    return res.status(201).json({ member });
  } catch (e: any) {
    const code = e?.message === 'forbidden' || e?.message === 'guest_invites_not_allowed' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'member_add_failed' });
  }
});

router.patch('/boards/:boardId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateMemberSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const member = await updateBoardMemberRole(
      req.params.boardId,
      userId,
      req.params.memberId,
      parsed.data.memberType,
      parsed.data.role
    );
    return res.json({ member });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'member_update_failed' });
  }
});

router.delete('/boards/:boardId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const memberType = String((req.query as any)?.memberType || 'user') as 'user' | 'guest';
    await removeBoardMember(req.params.boardId, userId, req.params.memberId, memberType);
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'member_remove_failed' });
  }
});

// Links
router.post('/cards/:cardId/links', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = addLinkSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const link = await addCardLink(req.params.cardId, userId, parsed.data);
    return res.status(201).json({ link });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'link_add_failed' });
  }
});

router.get('/cards/:cardId/links', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const links = await listCardLinks(req.params.cardId, userId);
    return res.json({ links });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'links_fetch_failed' });
  }
});

router.delete('/cards/:cardId/links/:linkId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await removeCardLink(req.params.cardId, userId, req.params.linkId);
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'link_remove_failed' });
  }
});

// Checklist
router.get('/cards/:cardId/checklist', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const items = await listChecklistItems(req.params.cardId, userId);
    return res.json({ items });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'checklist_fetch_failed' });
  }
});

router.post('/cards/:cardId/checklist', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'invalid_payload' });
    const item = await addChecklistItem(req.params.cardId, userId, body);
    return res.status(201).json({ item });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'checklist_add_failed' });
  }
});

router.patch('/cards/:cardId/checklist/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const item = await updateChecklistItem(req.params.cardId, userId, req.params.itemId, {
      body: req.body?.body,
      isCompleted: req.body?.isCompleted,
      position: req.body?.position,
    });
    return res.json({ item });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'checklist_update_failed' });
  }
});

router.delete('/cards/:cardId/checklist/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await removeChecklistItem(req.params.cardId, userId, req.params.itemId);
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'checklist_delete_failed' });
  }
});

// Comments
router.get('/cards/:cardId/comments', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const comments = await listCardComments(req.params.cardId, userId);
    return res.json({ comments });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'comments_fetch_failed' });
  }
});

router.post('/cards/:cardId/comments', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = addCommentSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const comment = await addCardComment(req.params.cardId, userId, parsed.data.body);
    return res.status(201).json({ comment });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'comment_add_failed' });
  }
});

export default router;

