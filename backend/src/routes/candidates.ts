import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { ApiRequest } from '../../types/api';
import { supabase } from '../lib/supabase';
import multer from 'multer';
import { candidateEnrichQueue } from '../queues/redis';
import { logger } from '../lib/logger';
import { basicParseFromText, type ParsedResume } from '../services/resumeParser';
import { ingestCandidateFromParsed } from '../services/candidateIngest';

const router = express.Router();

const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];

// Verify ownership helper
async function ensureCandidateOwnership(candidateId: string, userId: string) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, user_id')
    .eq('id', candidateId)
    .single();
  if (error || !data) return { ok: false, error: 'Candidate not found' };
  
  // Check if user can access this candidate (own or team member)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('team_id, role')
    .eq('id', userId)
    .single();

  if (userError) {
    return { ok: false, error: 'Failed to fetch user data' };
  }

  const isAdmin = ['admin', 'team_admin', 'super_admin'].includes(userData.role);
  
  // User owns the candidate
  if (data.user_id === userId) {
    return { ok: true };
  }
  
  // Admin can access all team candidates
  if (isAdmin && userData.team_id) {
    const { data: candidateUser } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', data.user_id)
      .single();
    
    if (candidateUser?.team_id === userData.team_id) {
      return { ok: true };
    }
  }
  
  // Team member can access shared candidates
  if (userData.team_id) {
    const { data: candidateUser } = await supabase
      .from('users')
      .select('team_id')
      .eq('id', data.user_id)
      .single();
    
    if (candidateUser?.team_id === userData.team_id) {
      // Check if candidate is shared
      const { data: candidate } = await supabase
        .from('candidates')
        .select('shared')
        .eq('id', candidateId)
        .single();
      
      if (candidate?.shared) {
        return { ok: true };
      }
    }
  }
  
  return { ok: false, error: 'Access denied' };
}

// PUT /api/candidates/:id - update candidate fields (limited)
router.put('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[PUT /api/candidates/:id] body=', req.body);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: 'Missing candidate id' });

    const own = await ensureCandidateOwnership(id, userId);
    if (!own.ok) return res.status(404).json({ error: own.error });

    const { status, first_name, last_name, email, phone, notes } = req.body || {};
    const update: any = {};
    if (status) {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(', ')}` });
      }
      update.status = status;
    }
    if (first_name !== undefined) update.first_name = first_name;
    if (last_name !== undefined) update.last_name = last_name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (notes !== undefined) update.notes = notes;

    const { data, error } = await supabase
      .from('candidates')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update candidate' });

    // Sync changes to the corresponding lead record if it exists
    if (data.lead_id) {
      const leadUpdate: any = {};
      if (first_name !== undefined) leadUpdate.first_name = first_name;
      if (last_name !== undefined) leadUpdate.last_name = last_name;
      if (email !== undefined) leadUpdate.email = email;
      if (phone !== undefined) leadUpdate.phone = phone;
      
      // Only update lead if there are fields to sync
      if (Object.keys(leadUpdate).length > 0) {
        try {
          await supabase
            .from('leads')
            .update(leadUpdate)
            .eq('id', data.lead_id)
            .eq('user_id', userId);
        } catch (leadSyncError) {
          console.warn('Failed to sync candidate update to lead:', leadSyncError);
          // Don't fail the candidate update if lead sync fails
        }
      }
    }

    try {
      const { emitZapEvent, ZAP_EVENT_TYPES } = await import('../../lib/zapEventEmitter');
      await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.CANDIDATE_UPDATED, eventData: data, sourceTable: 'candidates', sourceId: data.id });
    } catch {}

    return res.json(data);
  } catch (e) {
    console.error('Update candidate error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/candidates/:id - delete candidate
router.delete('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[DELETE /api/candidates/:id] id=', req.params.id);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: 'Missing candidate id' });

    const own = await ensureCandidateOwnership(id, userId);
    if (!own.ok) return res.status(404).json({ error: own.error });

    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to delete candidate' });

    try {
      const { emitZapEvent, ZAP_EVENT_TYPES } = await import('../../lib/zapEventEmitter');
      await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.CANDIDATE_UPDATED, eventData: { id, action: 'deleted' }, sourceTable: 'candidates', sourceId: id });
    } catch {}

    return res.json({ success: true });
  } catch (e) {
    console.error('Delete candidate error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/candidates/bulk-status { ids: string[], status: string }
router.post('/bulk-status', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids, status } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Missing ids' });
    if (!ALLOWED_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { error } = await supabase
      .from('candidates')
      .update({ status })
      .in('id', ids)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to update status' });
    return res.json({ success: true });
  } catch (e) {
    console.error('Bulk status error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/candidates/bulk-delete { ids: string[] }
router.post('/bulk-delete', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Missing ids' });

    const { error } = await supabase
      .from('candidates')
      .delete()
      .in('id', ids)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to delete candidates' });
    return res.json({ success: true });
  } catch (e) {
    console.error('Bulk delete error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/candidates/:id/enrich - re-enrich candidate data
router.post('/:id/enrich', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { mode } = (req.body || {}) as { mode?: 'sync' | 'async' };
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: 'Missing candidate id' });

    const own = await ensureCandidateOwnership(id, userId);
    if (!own.ok) return res.status(404).json({ error: own.error });

    // If async requested: enqueue job and return quickly
    if (mode === 'async') {
      await candidateEnrichQueue.add('enrich', { candidateId: id, userId: userId! }, { removeOnComplete: true });
      logger.info({ route: '/api/candidates/:id/enrich', orgId: undefined, action: 'enqueue', ok: true, candidateId: id, userId });
      return res.json({ queued: true });
    }

    // Get candidate data for enrichment (sync)
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (candidateError || !candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // For now, we'll simulate enrichment by using existing enrichment data
    // In a real implementation, you would call your enrichment services here
    const enrichmentData = candidate.enrichment_data || {};
    
    // Try to get email from various enrichment sources
    let enrichedEmail = null;
    let enrichmentSource = null;
    
    if (enrichmentData.apollo?.email && !enrichmentData.apollo.email.includes('email_not_unlocked')) {
      enrichedEmail = enrichmentData.apollo.email;
      enrichmentSource = 'Apollo';
    } else if (enrichmentData.hunter?.email) {
      enrichedEmail = enrichmentData.hunter.email;
      enrichmentSource = 'Hunter.io';
    } else if (enrichmentData.skrapp?.email) {
      enrichedEmail = enrichmentData.skrapp.email;
      enrichmentSource = 'Skrapp.io';
    } else if (enrichmentData.decodo?.email) {
      enrichedEmail = enrichmentData.decodo.email;
      enrichmentSource = 'Decodo';
    }

    if (!enrichedEmail) {
      return res.status(404).json({ error: 'No enrichment data available' });
    }

    // Update candidates table with enriched email
    const { data, error } = await supabase
      .from('candidates')
      .update({ 
        email: enrichedEmail,
        enrichment_source: enrichmentSource,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;

    // Also sync to the corresponding lead record if it exists
    if (data.lead_id) {
      try {
        await supabase
          .from('leads')
          .update({ 
            email: enrichedEmail,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.lead_id)
          .eq('user_id', userId);
      } catch (leadSyncError) {
        console.warn('Failed to sync enriched email to lead:', leadSyncError);
        // Don't fail the candidate update if lead sync fails
      }
    }

    logger.info({ route: '/api/candidates/:id/enrich', orgId: undefined, action: 'sync_update', ok: true, candidateId: id, userId });
    return res.json({ 
      email: data.email, 
      enrichment_source: enrichmentSource,
      updated_at: data.updated_at
    });
  } catch (e: any) {
    logger.error({ route: '/api/candidates/:id/enrich', action: 'error', ok: false, error: e?.message });
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

export default router;

// ===== Resume Wizard Endpoints =====
// POST /api/candidates/upload (multipart/form-data) -> { publicUrl }
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const UPLOADS_BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || 'candidate-uploads';

async function ensureUploadsBucket() {
  // Try to fetch bucket; if missing, create, then verify once more
  try {
    const { data: bucket } = await (supabase as any).storage.getBucket(UPLOADS_BUCKET);
    if (bucket) return true;
  } catch {}
  try {
    await (supabase as any).storage.createBucket(UPLOADS_BUCKET, { public: true, fileSizeLimit: 8388608 });
  } catch {}
  try {
    const { data: bucket2 } = await (supabase as any).storage.getBucket(UPLOADS_BUCKET);
    return !!bucket2;
  } catch { return false; }
}
router.post('/upload', requireAuth, upload.single('file'), async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'Missing file' });

    // Ensure bucket exists (retryable)
    const okBucket = await ensureUploadsBucket();
    if (!okBucket) return res.status(500).json({ error: 'uploads_bucket_unavailable' });

    const safeName = String(file.originalname || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `resumes/${userId}/${Date.now()}_${safeName}`;
    let { data: uploaded, error } = await (supabase as any).storage
      .from(UPLOADS_BUCKET)
      .upload(path, file.buffer, { upsert: false, contentType: file.mimetype || 'application/octet-stream' });
    if (error && /Bucket not found/i.test(String(error.message || ''))) {
      // Retry once after forcing bucket creation
      await ensureUploadsBucket();
      const retry = await (supabase as any).storage
        .from(UPLOADS_BUCKET)
        .upload(path, file.buffer, { upsert: false, contentType: file.mimetype || 'application/octet-stream' });
      uploaded = retry.data; error = retry.error;
    }
    if (error) return res.status(400).json({ error: error.message || 'upload_failed' });
    const { data: pub } = (supabase as any).storage.from(UPLOADS_BUCKET).getPublicUrl(uploaded.path);
    return res.json({ publicUrl: pub?.publicUrl || null, path: uploaded.path, bucket: UPLOADS_BUCKET });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'upload_failed' });
  }
});
// POST /api/candidates/parse { text?: string, file?: { name, data(base64) } }
router.post('/parse', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { text, file } = (req.body || {}) as { text?: string; file?: { name?: string; data?: string } };
    let plainText = text || '';
    // For v1: if file data provided, assume it's already extracted as text upstream in FE (to keep BE simple)
    if (!plainText && file?.data) {
      const b64 = String(file.data).split(',').pop() || '';
      // Naively treat as UTF-8 text file if provided; PDFs/DOCX should be extracted on FE or future worker
      plainText = Buffer.from(b64, 'base64').toString('utf8');
    }
    if (!plainText) return res.status(400).json({ error: 'No resume text' });

    const parsed: ParsedResume = basicParseFromText(plainText);
    res.json({ parsed });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'parse_failed' });
  }
});

// POST /api/candidates/ingest { parsed: ParsedResume, fileUrl? }
router.post('/ingest', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { parsed, fileUrl } = (req.body || {}) as { parsed?: ParsedResume; fileUrl?: string };
    if (!parsed) return res.status(400).json({ error: 'Missing parsed resume' });
    const { data: me } = await supabase.from('users').select('team_id').eq('id', userId).maybeSingle();
    const result = await ingestCandidateFromParsed({ userId, orgId: (me as any)?.team_id || null, filePublicUrl: fileUrl || null, parsed });
    res.json({ ok: true, candidateId: result.candidateId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'ingest_failed' });
  }
});

// GET /api/candidates/:id - fetch candidate with structured joins
router.get('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id as string | undefined;
    const id = String(req.params.id || '');
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!id) { res.status(400).json({ error: 'Missing candidate id' }); return; }

    const own = await ensureCandidateOwnership(id, userId);
    if (!own.ok) { res.status(404).json({ error: own.error }); return; }

    const { data: cand, error: cErr } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (cErr || !cand) { res.status(404).json({ error: 'Candidate not found' }); return; }

    const [{ data: contact }, { data: exp }, { data: edu }, { data: skills }, { data: tech }] = await Promise.all([
      supabase.from('candidate_contact').select('*').eq('candidate_id', id).maybeSingle(),
      supabase.from('candidate_experience').select('*').eq('candidate_id', id).order('start_date', { ascending: false }),
      supabase.from('candidate_education').select('*').eq('candidate_id', id).order('end_year', { ascending: false }),
      supabase.from('candidate_skill').select('*').eq('candidate_id', id),
      supabase.from('candidate_tech_stack').select('*').eq('candidate_id', id)
    ]);

    const out = {
      ...cand,
      contact: contact || null,
      experiences: exp || [],
      education: edu || [],
      skills: (skills || []).map((s: any) => s.skill),
      tech: (tech || []).map((t: any) => t.tech)
    };

    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'internal_error' });
  }
});

