import express, { Request, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';
import { extractTextFromBuffer } from '../ai/extractText';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const BUCKET = process.env.SUPABASE_RESUME_BUCKET || 'resume-drafts';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type DraftStatus = 'uploaded' | 'extracting' | 'ready_to_generate' | 'generating' | 'ready' | 'error';

const generatedSchema = z.object({
  targetRole: z.object({
    primaryTitle: z.string().optional(),
    focus: z.array(z.string()).optional(),
    industry: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string().optional(),
      dates: z.string().optional(),
      whyHiredSummary: z.string().optional(),
      bullets: z.array(z.string()),
      included: z.boolean().optional(),
    })
  ),
});

function cleanPath(path: string | null | undefined) {
  if (!path) return null;
  const stripped = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/sign\/[^/]+\/(.*)$/i, '$1');
  if (stripped.startsWith(`${BUCKET}/`)) return stripped.slice(BUCKET.length + 1);
  return stripped;
}

async function ensureBucket() {
  try {
    const { data } = await (supabase as any).storage.getBucket(BUCKET);
    if (data) return true;
  } catch {}
  try {
    await (supabase as any).storage.createBucket(BUCKET, { public: false });
  } catch {}
  try {
    const { data } = await (supabase as any).storage.getBucket(BUCKET);
    return !!data;
  } catch {
    return false;
  }
}

async function uploadFile(file: Express.Multer.File, userId: string, kind: 'resume' | 'linkedin') {
  const ok = await ensureBucket();
  if (!ok) throw new Error('storage_unavailable');
  const safeName = String(file.originalname || `${kind}.pdf`).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `${kind}s/${userId}/${Date.now()}_${safeName}`;
  let { data, error } = await (supabase as any).storage
    .from(BUCKET)
    .upload(path, file.buffer, { upsert: false, contentType: file.mimetype || 'application/octet-stream' });
  if (error && /bucket not found/i.test(String(error.message || ''))) {
    await ensureBucket();
    const retry = await (supabase as any).storage
      .from(BUCKET)
      .upload(path, file.buffer, { upsert: false, contentType: file.mimetype || 'application/octet-stream' });
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message || 'upload_failed');
  return data?.path || path;
}

async function fetchDraft(id: string, userId: string) {
  const { data, error } = await supabase.from('job_resume_drafts').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message || 'draft_fetch_failed');
  if (!data) throw new Error('draft_not_found');
  return data as any;
}

router.post('/', requireAuth, upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'missing_resume' });

    const path = await uploadFile(file, userId, 'resume');
    const { data, error } = await supabase
      .from('job_resume_drafts')
      .insert({ user_id: userId, resume_file_url: path, status: 'uploaded' as DraftStatus })
      .select('id, status, resume_file_url, created_at')
      .single();
    if (error) return res.status(400).json({ error: error.message || 'create_failed' });
    res.status(201).json({ draft: data });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'create_failed' });
  }
});

router.post('/:id/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { id } = req.params;
    const file = (req as any).file as Express.Multer.File | undefined;
    const fileType = String((req.body?.type as string) || 'linkedin').toLowerCase() === 'resume' ? 'resume' : 'linkedin';
    if (!file) return res.status(400).json({ error: 'missing_file' });

    await fetchDraft(id, userId); // ownership check
    const path = await uploadFile(file, userId, fileType);
    const patch: any = { status: 'uploaded' as DraftStatus, error_message: null };
    if (fileType === 'resume') patch.resume_file_url = path;
    else patch.linkedin_file_url = path;

    const { data, error } = await supabase
      .from('job_resume_drafts')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message || 'upload_failed' });
    res.json({ draft: data });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'upload_failed' });
  }
});

router.post('/:id/extract', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { id } = req.params;
    const draft = await fetchDraft(id, userId);
    const resumePath = cleanPath(draft.resume_file_url);
    if (!resumePath) return res.status(400).json({ error: 'resume_missing' });

    await supabase.from('job_resume_drafts').update({ status: 'extracting' as DraftStatus, error_message: null }).eq('id', id).eq('user_id', userId);

    const resumeDownload = await (supabase as any).storage.from(BUCKET).download(resumePath);
    if (resumeDownload.error) throw new Error(resumeDownload.error.message || 'resume_download_failed');
    const resumeText = await extractTextFromBuffer(await resumeDownload.data.arrayBuffer().then((b: ArrayBuffer) => Buffer.from(b)), resumeDownload.data.type || 'application/octet-stream');

    let linkedinText: string | null = draft.linkedin_text || null;
    const linkedinPath = cleanPath(draft.linkedin_file_url);
    if (linkedinPath) {
      const linkedinDownload = await (supabase as any).storage.from(BUCKET).download(linkedinPath);
      if (!linkedinDownload.error) {
        linkedinText = await extractTextFromBuffer(
          await linkedinDownload.data.arrayBuffer().then((b: ArrayBuffer) => Buffer.from(b)),
          linkedinDownload.data.type || 'application/pdf'
        );
      }
    }

    const { error } = await supabase
      .from('job_resume_drafts')
      .update({
        resume_text: resumeText || null,
        linkedin_text: linkedinText || null,
        status: 'ready_to_generate' as DraftStatus,
        error_message: null,
      })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message || 'extract_failed');
    res.json({ ok: true });
  } catch (e: any) {
    try {
      const userId = (req as any).user?.id as string | undefined;
      const { id } = req.params;
      if (userId && id) {
        await supabase
          .from('job_resume_drafts')
          .update({ status: 'error' as DraftStatus, error_message: e?.message || 'extract_failed' })
          .eq('id', id)
          .eq('user_id', userId);
      }
    } catch {}
    res.status(500).json({ error: e?.message || 'extract_failed' });
  }
});

router.post('/:id/generate', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const draft = await fetchDraft(id, userId);
    if (!draft.resume_text) return res.status(400).json({ error: 'resume_text_missing' });

    await supabase.from('job_resume_drafts').update({ status: 'generating' as DraftStatus, error_message: null }).eq('id', id).eq('user_id', userId);

    const system = 'You are REX, an expert resume rewritter. Return strictly valid JSON. No markdown. No commentary.';
    const userPrompt = [
      'Resume text:',
      draft.resume_text,
      '',
      'LinkedIn text (optional):',
      draft.linkedin_text || '(none provided)',
      '',
      'Output JSON schema exactly as provided:',
      JSON.stringify({
        targetRole: { primaryTitle: 'string', focus: ['Leadership'], industry: ['B2B SaaS'], notes: 'string' },
        summary: 'string',
        skills: ['string'],
        experience: [
          {
            company: 'string',
            title: 'string',
            location: 'string',
            dates: 'string',
            whyHiredSummary: 'string',
            bullets: ['string'],
            included: true,
          },
        ],
      }),
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = generatedSchema.parse(JSON.parse(raw));

    const { error } = await supabase
      .from('job_resume_drafts')
      .update({
        generated_resume_json: parsed,
        status: 'ready' as DraftStatus,
        error_message: null,
      })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message || 'save_failed');

    res.json({ draftId: id, generated: parsed });
  } catch (e: any) {
    try {
      await supabase
        .from('job_resume_drafts')
        .update({ status: 'error' as DraftStatus, error_message: e?.message || 'generate_failed' })
        .eq('id', id)
        .eq('user_id', userId);
    } catch {}
    res.status(500).json({ error: e?.message || 'generate_failed' });
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { id } = req.params;
    const draft = await fetchDraft(id, userId);
    res.json({ draft });
  } catch (e: any) {
    res.status(404).json({ error: e?.message || 'draft_not_found' });
  }
});

export default router;

