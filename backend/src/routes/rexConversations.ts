import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../middleware/authMiddleware';

// Types
export type RexConversation = {
  id: string;
  user_id: string;
  title: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type RexMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user'|'assistant'|'system'|'tool';
  content: any;
  created_at: string;
};

const router = Router();

function supabaseForRequest(req: any) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
  const authHeader = (req.headers.authorization as string) || '';
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} }
  });
}

// POST /api/rex/conversations
router.post('/rex/conversations', requireAuth as any, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const title = String((req.body?.title ?? 'New chat')).slice(0, 120);
    const supabase = supabaseForRequest(req);

    const { data, error } = await supabase
      .from('rex_conversations')
      .insert({ user_id: userId, title })
      .select('*')
      .single();
    if (error) { res.status(400).json({ error: error.message }); return; }

    // prune non-archived by updated_at after top 15, excluding pinned
    const { data: toPrune } = await supabase
      .from('rex_conversations')
      .select('id, pinned')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .range(15, 999);

    const deletable = (toPrune || []).filter(c => !c.pinned).map(c => c.id);
    if (deletable.length) {
      await supabase.from('rex_conversations').delete().in('id', deletable);
    }

    res.json({ conversation: data as RexConversation });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/rex/conversations
router.get('/rex/conversations', requireAuth as any, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const supabase = supabaseForRequest(req);

    const { data: pinned } = await supabase
      .from('rex_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('pinned', true)
      .eq('archived', false)
      .order('updated_at', { ascending: false });

    const { data: recent } = await supabase
      .from('rex_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('pinned', false)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(15);

    res.json({ conversations: [ ...(pinned || []), ...(recent || []) ] as RexConversation[] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/rex/conversations/:id/messages
router.get('/rex/conversations/:id/messages', requireAuth as any, async (req, res) => {
  try {
    const supabase = supabaseForRequest(req);
    const { id } = req.params as { id: string };
    const { data, error } = await supabase
      .from('rex_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ messages: (data || []) as RexMessage[] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// POST /api/rex/conversations/:id/messages
router.post('/rex/conversations/:id/messages', requireAuth as any, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const supabase = supabaseForRequest(req);
    const { id } = req.params as { id: string };
    const { role, content } = req.body as { role: RexMessage['role']; content: any };

    const { data, error } = await supabase
      .from('rex_messages')
      .insert({ conversation_id: id, user_id: userId, role, content })
      .select('*')
      .single();
    if (error) { res.status(400).json({ error: error.message }); return; }

    await supabase.from('rex_conversations').update({ updated_at: new Date().toISOString() as any }).eq('id', id);

    if (role === 'user') {
      const preview = String(content?.text || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      await supabase.from('rex_conversations').update({ title: preview || 'New chat' }).eq('id', id);
    }

    res.json({ message: data as RexMessage });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// PATCH /api/rex/conversations/:id
router.patch('/rex/conversations/:id', requireAuth as any, async (req, res) => {
  try {
    const supabase = supabaseForRequest(req);
    const { id } = req.params as { id: string };
    const patch: any = {};
    ['pinned','archived','title'].forEach(k => {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = (req.body as any)[k];
    });
    const { data, error } = await supabase
      .from('rex_conversations')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ conversation: data as RexConversation });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;


