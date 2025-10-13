import { Router } from 'express';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import { requireAuthUnified as requireAuth } from '../../middleware/requireAuthUnified';
import { supabaseAdmin } from '../lib/supabaseAdmin';

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
    let updatedCount = 0;
    let skippedCount = 0;
    const createdIds: string[] = [];
    const errors: any[] = [];

    for (const r of rows) {
      // Insert candidate
      // Normalize enrichment_data
      let enrichment: any = r.enrichment_data || {};
      if (typeof enrichment === 'string') {
        try { enrichment = JSON.parse(enrichment); } catch { enrichment = {}; }
      }
      const baseCandidate = {
          user_id: userId,
          first_name: (r.first_name || (r.full_name || '').split(' ')[0] || '').trim() || null,
          last_name: (r.last_name || ((r.full_name || '').split(' ').slice(1).join(' ')) || '').trim() || null,
          email: (r.email || null),
          title: (r.title || null),
          company: (r.company || null),
          linkedin_url: (r.linkedin_url || null),
          enrichment_data: enrichment,
          status: 'sourced'
      } as any;

      let cid: string | undefined;
      try {
        const { data: ins, error: insErr } = await supabaseAdmin
          .from('candidates')
          .insert(baseCandidate)
          .select('id')
          .maybeSingle();
        if (insErr) throw insErr;
        createdCount += 1;
        cid = (ins as any)?.id;
        if (cid) createdIds.push(cid);
      } catch (e: any) {
        // If duplicate due to email existing, update existing row
        if (String(e?.message || '').toLowerCase().includes('duplicate') || String(e?.details || '').toLowerCase().includes('already exists')) {
          if (baseCandidate.email) {
            const { data: existing } = await supabaseAdmin
              .from('candidates')
              .select('id')
              .eq('user_id', userId)
              .eq('email', baseCandidate.email)
              .maybeSingle();
            if (existing?.id) {
              cid = existing.id;
              const { error: updErr } = await supabaseAdmin
                .from('candidates')
                .update({
                  first_name: baseCandidate.first_name,
                  last_name: baseCandidate.last_name,
                  title: baseCandidate.title,
                  company: baseCandidate.company,
                  linkedin_url: baseCandidate.linkedin_url,
                  enrichment_data: baseCandidate.enrichment_data,
                })
                .eq('id', cid);
              if (!updErr) updatedCount += 1; else errors.push({ email: baseCandidate.email, error: updErr.message });
            } else {
              skippedCount += 1;
              errors.push({ email: baseCandidate.email, error: 'duplicate_email_no_id' });
            }
          } else {
            skippedCount += 1;
            errors.push({ error: 'duplicate_without_email' });
          }
        } else {
          skippedCount += 1;
          errors.push({ email: baseCandidate.email, error: e?.message || 'insert_failed' });
        }
      }

      // Upsert contact details
      if (cid) {
        await supabaseAdmin
          .from('candidate_contact')
          .upsert({ candidate_id: cid, email: r.email || null, phone: r.phone || null, linkedin_url: r.linkedin_url || null }, { onConflict: 'candidate_id' });
      }
    }

    res.json({ ok: true, createdCount, updatedCount, skippedCount, candidateIds: createdIds, errors: errors.slice(0, 10) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'csv_import_failed' });
  }
});


