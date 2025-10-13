import { Router } from 'express';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import { requireAuthUnified as requireAuth } from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';

export const candidatesCsvRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/candidates/import/csv (multipart/form-data with file OR JSON { rows: [...] })
candidatesCsvRouter.post('/api/candidates/import/csv', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    let rows: any[] = [];
    const file = (req as any).file as Express.Multer.File | undefined;
    if (req.is('application/json') && Array.isArray((req as any).body?.rows)) {
      rows = (req as any).body.rows as any[];
    } else {
      if (!file) { res.status(400).json({ error: 'file missing' }); return; }
      const text = file.buffer.toString('utf8');
      rows = parseCsv(text, { columns: true, skip_empty_lines: true });
    }

    let createdCount = 0;
    const createdIds: string[] = [];

    for (const r of rows) {
      // Insert candidate
      const { data: ins, error: insErr } = await supabase
        .from('candidates')
        .insert({
          user_id: userId,
          first_name: (r.first_name || (r.full_name || '').split(' ')[0] || '').trim() || null,
          last_name: (r.last_name || ((r.full_name || '').split(' ').slice(1).join(' ')) || '').trim() || null,
          email: (r.email || null),
          title: (r.title || null),
          company: (r.company || null),
          linkedin_url: (r.linkedin_url || null),
          enrichment_data: r.enrichment_data || {},
          status: 'sourced'
        })
        .select('id')
        .maybeSingle();

      if (insErr) continue;
      createdCount += 1;
      const cid = (ins as any)?.id;
      if (cid) createdIds.push(cid);

      // Upsert contact details
      if (cid) {
        await supabase
          .from('candidate_contact')
          .upsert({ candidate_id: cid, email: r.email || null, phone: r.phone || null, linkedin_url: r.linkedin_url || null }, { onConflict: 'candidate_id' });
      }
    }

    res.json({ ok: true, createdCount, candidateIds: createdIds });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'csv_import_failed' });
  }
});


