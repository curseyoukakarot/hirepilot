import express, { Request, Response } from 'express';
import activeWorkspace from '../middleware/activeWorkspace';
import { requireApiKeyScopes } from '../middleware/requireApiKeyScopes';
import {
  archiveBoard,
  archiveCard,
  archiveList,
  createBoard,
  createCard,
  createList,
  getBoardById,
  listBoardMembers,
  listBoards,
  moveCard,
  reorderList,
  updateBoard,
  updateBoardMemberRole,
  updateCard,
  updateList,
  removeBoardMember,
} from '../services/kanban/kanbanService';
import {
  createBoardSchema,
  updateBoardSchema,
  createListSchema,
  updateListSchema,
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
  updateMemberSchema,
} from '../services/kanban/kanbanSchemas';
import { listBoardCards, getCardById } from '../services/kanban/kanbanPublicService';
import { createBinding, deleteBinding, listBindings, touchBindingSync, updateBinding } from '../services/kanban/kanbanBindingsService';
import { emitWebhookEvent } from '../services/webhooks';
import { supabaseDb } from '../lib/supabase';

const router = express.Router();
router.use(requireApiKeyScopes(['kanban:read']), activeWorkspace as any);

function resolveWorkspaceId(req: Request): string | null {
  const headerWorkspace = String((req.headers['x-workspace-id'] as string | undefined) || '').trim();
  const queryWorkspace = String((req.query as any)?.workspace_id || '').trim();
  const ctxWorkspace = String((req as any)?.workspaceId || '').trim();
  return headerWorkspace || queryWorkspace || ctxWorkspace || null;
}

// Boards
router.get('/boards', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const boards = await listBoards(userId, resolveWorkspaceId(req));
    return res.json({ boards });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'boards_fetch_failed' });
  }
});

router.post('/boards', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = createBoardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const board = await createBoard(userId, {
      workspaceId: parsed.data.workspaceId || resolveWorkspaceId(req),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      boardType: parsed.data.boardType ?? null,
    });
    await emitWebhookEvent(userId, 'kanban.board.created', {
      workspace_id: resolveWorkspaceId(req),
      board_id: board.id,
      actor_user_id: userId,
      source: 'api_key',
      data: { board },
    });
    return res.status(201).json({ board });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'board_create_failed' });
  }
});

router.get('/boards/:boardId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const board = await getBoardById(req.params.boardId, userId, resolveWorkspaceId(req));
    return res.json({ board });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 404;
    return res.status(code).json({ error: e?.message || 'board_fetch_failed' });
  }
});

router.patch('/boards/:boardId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateBoardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const board = await updateBoard(req.params.boardId, userId, parsed.data);
    await emitWebhookEvent(userId, 'kanban.board.updated', {
      workspace_id: resolveWorkspaceId(req),
      board_id: board.id,
      actor_user_id: userId,
      source: 'api_key',
      data: { board },
    });
    return res.json({ board });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'board_update_failed' });
  }
});

router.post('/boards/:boardId/archive', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await archiveBoard(req.params.boardId, userId);
    await emitWebhookEvent(userId, 'kanban.board.archived', {
      workspace_id: resolveWorkspaceId(req),
      board_id: req.params.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: {},
    });
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'board_archive_failed' });
  }
});

// Members / invites
router.get('/boards/:boardId/members', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const members = await listBoardMembers(req.params.boardId, userId);
    return res.json({ members });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'members_fetch_failed' });
  }
});

router.post('/boards/:boardId/invites', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'editor') as any;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    if (!email) return res.status(400).json({ error: 'missing_email' });
    await getBoardById(req.params.boardId, userId, resolveWorkspaceId(req));
    const { data, error } = await supabaseDb
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
    await emitWebhookEvent(userId, 'kanban.board.member.invited', {
      workspace_id: resolveWorkspaceId(req),
      board_id: req.params.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { invite: data },
    });
    return res.status(201).json({ invite: data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'invite_create_failed' });
  }
});

router.post('/invites/:inviteId/accept', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { data: user } = await supabaseDb.from('users').select('email').eq('id', userId).maybeSingle();
    const { data: invite } = await supabaseDb.from('kanban_board_invites').select('*').eq('id', req.params.inviteId).maybeSingle();
    if (!invite) return res.status(404).json({ error: 'invite_not_found' });
    if (String(invite.status) !== 'pending') return res.status(400).json({ error: 'invite_not_pending' });
    if (user?.email && String(invite.email).toLowerCase() !== String(user.email).toLowerCase()) {
      return res.status(403).json({ error: 'invite_email_mismatch' });
    }
    await supabaseDb
      .from('kanban_board_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', req.params.inviteId);
    const { data: memberRow, error: memberError } = await supabaseDb
      .from('kanban_board_members')
      .upsert(
        {
          board_id: invite.board_id,
          member_type: 'user',
          member_id: userId,
          role: invite.role,
        },
        { onConflict: 'board_id,member_type,member_id' }
      )
      .select('id,board_id,member_type,member_id,role,created_at')
      .single();
    if (memberError) throw memberError;
    const member = {
      id: memberRow.id,
      boardId: memberRow.board_id,
      memberType: memberRow.member_type,
      memberId: memberRow.member_id,
      role: memberRow.role,
      createdAt: memberRow.created_at,
      user: { id: userId, email: user?.email || null },
    };
    await emitWebhookEvent(userId, 'kanban.board.member.joined', {
      workspace_id: resolveWorkspaceId(req),
      board_id: String(invite.board_id),
      actor_user_id: userId,
      source: 'api_key',
      data: { member },
    });
    return res.json({ member });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'invite_accept_failed' });
  }
});

router.patch('/boards/:boardId/members/:memberId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateMemberSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const member = await updateBoardMemberRole(req.params.boardId, userId, req.params.memberId, parsed.data.memberType, parsed.data.role);
    return res.json({ member });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'member_update_failed' });
  }
});

router.delete('/boards/:boardId/members/:memberId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const memberType = String((req.query as any)?.member_type || 'user') as any;
    await removeBoardMember(req.params.boardId, userId, req.params.memberId, memberType);
    return res.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === 'forbidden' ? 403 : 500;
    return res.status(code).json({ error: e?.message || 'member_remove_failed' });
  }
});

// Columns
router.get('/boards/:boardId/columns', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const board = await getBoardById(req.params.boardId, userId, resolveWorkspaceId(req));
    return res.json({ columns: board.lists });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'columns_fetch_failed' });
  }
});

router.post('/boards/:boardId/columns', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = createListSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const columns = await createList(req.params.boardId, userId, parsed.data);
    await emitWebhookEvent(userId, 'kanban.column.created', {
      workspace_id: resolveWorkspaceId(req),
      board_id: req.params.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { columns },
    });
    return res.status(201).json({ columns });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'column_create_failed' });
  }
});

router.patch('/columns/:columnId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateListSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const column = await updateList(req.params.columnId, userId, parsed.data);
    await emitWebhookEvent(userId, 'kanban.column.updated', {
      workspace_id: resolveWorkspaceId(req),
      board_id: column.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { column },
    });
    return res.json({ column });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'column_update_failed' });
  }
});

router.post('/columns/:columnId/reorder', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const toIndex = Number(req.body?.toIndex ?? req.body?.position ?? 0);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const columns = await reorderList(req.params.columnId, userId, toIndex);
    return res.json({ columns });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'column_reorder_failed' });
  }
});

router.delete('/columns/:columnId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await archiveList(req.params.columnId, userId);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'column_delete_failed' });
  }
});

// Cards
router.get('/boards/:boardId/cards', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const result = await listBoardCards(req.params.boardId, userId, resolveWorkspaceId(req), {
      columnId: String((req.query as any)?.column_id || '') || null,
      query: String((req.query as any)?.q || '') || null,
      assigneeId: String((req.query as any)?.assignee_id || '') || null,
      label: String((req.query as any)?.label || '') || null,
      updatedAfter: String((req.query as any)?.updated_after || '') || null,
      page: Number((req.query as any)?.page || 1),
      pageSize: Number((req.query as any)?.page_size || 50),
    });
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'cards_fetch_failed' });
  }
});

router.post('/boards/:boardId/cards', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = createCardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const cards = await createCard(parsed.data.listId, userId, parsed.data);
    const createdCard = cards.find((card) => card.listId === parsed.data.listId) || cards[0];
    await emitWebhookEvent(userId, 'kanban.card.created', {
      workspace_id: resolveWorkspaceId(req),
      board_id: req.params.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { card: createdCard },
    });
    return res.status(201).json({ cards });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'card_create_failed' });
  }
});

router.get('/cards/:cardId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const card = await getCardById(req.params.cardId, userId, resolveWorkspaceId(req));
    if (!card) return res.status(404).json({ error: 'card_not_found' });
    return res.json({ card });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'card_fetch_failed' });
  }
});

router.patch('/cards/:cardId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = updateCardSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const card = await updateCard(req.params.cardId, userId, parsed.data);
    await emitWebhookEvent(userId, 'kanban.card.updated', {
      workspace_id: resolveWorkspaceId(req),
      board_id: card.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { card },
    });
    return res.json({ card });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'card_update_failed' });
  }
});

router.post('/cards/:cardId/move', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const parsed = moveCardSchema.safeParse({
      fromListId: req.body?.from_column_id || req.body?.fromListId,
      toListId: req.body?.to_column_id || req.body?.toListId,
      toIndex: req.body?.position ?? req.body?.toIndex,
    });
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const result = await moveCard(req.params.cardId, userId, parsed.data);
    await emitWebhookEvent(userId, 'kanban.card.moved', {
      workspace_id: resolveWorkspaceId(req),
      board_id: result.card?.boardId || null,
      actor_user_id: userId,
      source: 'api_key',
      data: result,
    });
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'card_move_failed' });
  }
});

router.post('/cards/bulk', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const moves = Array.isArray(req.body?.move) ? req.body.move : [];
    const updates = Array.isArray(req.body?.update) ? req.body.update : [];
    const archives = Array.isArray(req.body?.archive) ? req.body.archive : [];

    const results = {
      moved: [],
      updated: [],
      archived: [],
    } as any;

    for (const move of moves) {
      const parsed = moveCardSchema.safeParse({
        fromListId: move.from_column_id || move.fromListId,
        toListId: move.to_column_id || move.toListId,
        toIndex: move.position ?? move.toIndex,
      });
      if (!parsed.success) continue;
      const result = await moveCard(String(move.card_id || move.cardId), userId, parsed.data);
      await emitWebhookEvent(userId, 'kanban.card.moved', {
        workspace_id: resolveWorkspaceId(req),
        board_id: result.card?.boardId || null,
        actor_user_id: userId,
        source: 'api_key',
        data: result,
      });
      results.moved.push(result);
    }

    for (const update of updates) {
      const parsed = updateCardSchema.safeParse(update);
      if (!parsed.success) continue;
      const card = await updateCard(String(update.card_id || update.cardId), userId, parsed.data);
      await emitWebhookEvent(userId, 'kanban.card.updated', {
        workspace_id: resolveWorkspaceId(req),
        board_id: card.boardId,
        actor_user_id: userId,
        source: 'api_key',
        data: { card },
      });
      results.updated.push(card);
    }

    for (const archive of archives) {
      const cardId = String(archive.card_id || archive.cardId || '');
      if (!cardId) continue;
      await archiveCard(cardId, userId);
      results.archived.push({ cardId });
    }

    return res.json(results);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'bulk_failed' });
  }
});

// Bindings
router.get('/boards/:boardId/bindings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const bindings = await listBindings(req.params.boardId, userId, resolveWorkspaceId(req));
    return res.json({ bindings });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'bindings_fetch_failed' });
  }
});

router.post('/boards/:boardId/bindings', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const binding = await createBinding(req.params.boardId, userId, resolveWorkspaceId(req), {
      targetType: req.body?.target_type,
      targetId: req.body?.target_id,
      mode: req.body?.mode,
      groupBy: req.body?.group_by,
      columnMap: req.body?.column_map,
      syncDirection: req.body?.sync_direction,
    });
    await emitWebhookEvent(userId, 'kanban.binding.created', {
      workspace_id: resolveWorkspaceId(req),
      board_id: req.params.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { binding },
    });
    return res.status(201).json({ binding });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'binding_create_failed' });
  }
});

router.patch('/bindings/:bindingId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const binding = await updateBinding(req.params.bindingId, userId, {
      targetType: req.body?.target_type,
      targetId: req.body?.target_id,
      mode: req.body?.mode,
      groupBy: req.body?.group_by,
      columnMap: req.body?.column_map,
      syncDirection: req.body?.sync_direction,
    });
    await emitWebhookEvent(userId, 'kanban.binding.updated', {
      workspace_id: resolveWorkspaceId(req),
      board_id: binding.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { binding },
    });
    return res.json({ binding });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'binding_update_failed' });
  }
});

router.delete('/bindings/:bindingId', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    await deleteBinding(req.params.bindingId, userId);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'binding_delete_failed' });
  }
});

router.post('/bindings/:bindingId/refresh', requireApiKeyScopes(['kanban:write']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const binding = await touchBindingSync(req.params.bindingId, userId);
    await emitWebhookEvent(userId, 'kanban.binding.synced', {
      workspace_id: resolveWorkspaceId(req),
      board_id: binding.boardId,
      actor_user_id: userId,
      source: 'api_key',
      data: { binding },
    });
    return res.json({ binding });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'binding_refresh_failed' });
  }
});

export default router;
