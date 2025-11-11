import express from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../src/middleware/authenticate';
import {
  formCreateDto,
  formPatchDto,
  fieldsUpsertArrayDto,
  submissionPayloadDto,
} from './dto';
import {
  createForm,
  getForm,
  listForms,
  removeForm,
  submitFormBySlug,
  togglePublish,
  updateForm,
  upsertFields,
  listResponses,
  getResponseDetail,
  getFormPublicBySlug,
} from './service';
import { getSignedUploadUrl } from './uploads';
import { supabaseDb } from '../lib/supabase';

const router = express.Router();

// GET /api/forms list user forms (paginate)
router.get('/', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const page = Number(req.query.page || '1');
    const q = (req.query.q as string | undefined) || undefined;
    const data = await listForms(auth.userId, isNaN(page) ? 1 : page, q);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// POST /api/forms create form
router.post('/', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const body = formCreateDto.parse(req.body || {});
    const workspaceId = (req as any)?.user?.workspace_id || (req.headers['x-workspace-id'] as string) || auth.user?.app_metadata?.workspace_id || auth.userId;
    const form = await createForm(auth.userId, workspaceId, body);
    res.status(201).json(form);
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return res.status(400).json({ error: 'validation_error', details: e.issues });
    }
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// GET /api/forms/by-slug/:slug public read
router.get('/by-slug/:slug', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const form = await getFormPublicBySlug(slug);
    if (!form) return res.status(404).json({ error: 'not_found' });
    res.json(form);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// GET /api/forms/:id get form + fields (owner only)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const form = await getForm(id, auth.userId);
    res.json(form);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// PATCH /api/forms/:id update meta
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const body = formPatchDto.parse(req.body || {});
    const form = await updateForm(id, body, auth.userId);
    res.json(form);
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return res.status(400).json({ error: 'validation_error', details: e.issues });
    }
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// DELETE /api/forms/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    await removeForm(id, auth.userId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// POST /api/forms/:id/fields bulk upsert fields
router.post('/:id/fields', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const fields = fieldsUpsertArrayDto.parse(req.body || []);
    const data = await upsertFields(id, fields, auth.userId);
    res.json({ fields: data });
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return res.status(400).json({ error: 'validation_error', details: e.issues });
    }
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// POST /api/forms/:id/publish
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const is_public = Boolean((req.body || {}).is_public);
    const form = await togglePublish(id, is_public, auth.userId);
    res.json(form);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// POST /api/forms/:slug/submit public submission endpoint
router.post('/:slug/submit', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const payload = submissionPayloadDto.parse(req.body || {});
    const result = await submitFormBySlug(req, slug, payload);
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return res.status(400).json({ error: 'validation_error', details: e.issues });
    }
    if ((e?.message || '').includes('form_not_found')) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// GET /api/forms/:id/responses list responses + key values (paginate)
router.get('/:id/responses', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const page = Number(req.query.page || '1');
    const data = await listResponses(id, isNaN(page) ? 1 : page, auth.userId);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// GET /api/forms/:id/responses/:responseId response detail
router.get('/:id/responses/:responseId', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const responseId = String(req.params.responseId);
    const data = await getResponseDetail(id, responseId, auth.userId);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// POST /api/forms/uploads signed URL for file uploads
router.post('/uploads', async (req: Request, res: Response) => {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename || !contentType) return res.status(400).json({ error: 'missing_params' });
    const url = await getSignedUploadUrl(String(filename), String(contentType));
    res.json(url);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// GET /api/forms/options/custom-tables - list user's custom tables for selector
router.get('/options/custom-tables', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const { data, error } = await supabaseDb
      .from('custom_tables')
      .select('id,name')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

// GET /api/forms/options/job-reqs - list job requisitions
router.get('/options/job-reqs', async (req: Request, res: Response) => {
  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    // Best-effort: list recent job requisitions
    const { data, error } = await supabaseDb
      .from('job_requisitions')
      .select('id,title,status,created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

export default router;
export const formsRouter = router;


