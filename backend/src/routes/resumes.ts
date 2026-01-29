import express, { Request, Response } from 'express';
import { createHash } from 'crypto';
import sharp from 'sharp';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';
import { downloadBytes, getSignedUrl, uploadBytes } from '../lib/storageBytes';
import { circleMaskPng } from '../lib/resume/photoMask';
import { renderResumePdf } from '../lib/resume/renderResumePdf';

const router = express.Router();

type TemplateConfig = {
  assets?: {
    base_pdf?: { storage_bucket: string; storage_path: string };
  };
  fonts?: Record<string, { storage_bucket: string; storage_path: string }>;
  photo?: {
    enabled?: boolean;
    box?: { page: number; x: number; y: number; w: number; h: number; shape?: 'circle' | 'square' };
    source?: 'resume_or_profile' | string;
  };
  layout?: any;
};

function parseStorageUrl(url: string) {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/i);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

async function downloadPhotoBytes(photoUrl: string) {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) {
    const loc = parseStorageUrl(photoUrl);
    if (loc) {
      return downloadBytes(loc.bucket, loc.path);
    }
    const resp = await fetch(photoUrl);
    if (!resp.ok) throw new Error('photo_download_failed');
    return new Uint8Array(await resp.arrayBuffer());
  }
  const trimmed = photoUrl.replace(/^\/+/, '');
  const parts = trimmed.split('/');
  if (parts.length < 2) return null;
  const bucket = parts.shift() as string;
  const path = parts.join('/');
  return downloadBytes(bucket, path);
}

async function resolveTemplate(
  userId: string,
  templateSlug?: string | null,
  templateId?: string | null
) {
  if (templateSlug) {
    const { data, error } = await supabase
      .from('resume_templates')
      .select('id,name,slug,template_config,is_ats_safe,is_one_page')
      .eq('slug', templateSlug)
      .maybeSingle();
    if (error) throw new Error(error.message || 'template_lookup_failed');
    return data || null;
  }

  if (templateId) {
    const { data, error } = await supabase
      .from('resume_templates')
      .select('id,name,slug,template_config,is_ats_safe,is_one_page')
      .eq('id', templateId)
      .maybeSingle();
    if (error) throw new Error(error.message || 'template_lookup_failed');
    if (data) return data;
  }

  try {
    const { data: settings } = await supabase
      .from('user_resume_settings')
      .select('selected_template_id')
      .eq('user_id', userId)
      .maybeSingle();
    const selectedId = (settings as any)?.selected_template_id || null;
    if (selectedId) {
      const { data: tpl } = await supabase
        .from('resume_templates')
        .select('id,name,slug,template_config,is_ats_safe,is_one_page')
        .eq('id', selectedId)
        .maybeSingle();
      if (tpl) return tpl;
    }
  } catch {}

  const { data: fallback } = await supabase
    .from('resume_templates')
    .select('id,name,slug,template_config,is_ats_safe,is_one_page')
    .eq('slug', 'ats_safe_classic')
    .maybeSingle();
  return fallback || null;
}

router.post('/:resumeId/export', requireAuthUnified as any, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { resumeId } = req.params;
    const templateSlug = String((req.body as any)?.templateSlug || '').trim() || null;
    const debug = String((req.query as any)?.debug || '') === '1';

    const { data: resume, error: resumeErr } = await supabase
      .from('job_resume_drafts')
      .select('id,user_id,generated_resume_json,template_slug,template_id')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .maybeSingle();
    if (resumeErr) return res.status(500).json({ error: resumeErr.message || 'resume_lookup_failed' });
    if (!resume) return res.status(404).json({ error: 'resume_not_found' });

    const draftTemplateSlug = String((resume as any)?.template_slug || '').trim() || null;
    const draftTemplateId = String((resume as any)?.template_id || '').trim() || null;
    const template = await resolveTemplate(userId, templateSlug || draftTemplateSlug, draftTemplateId);
    if (!template) return res.status(404).json({ error: 'template_not_found' });

    const templateConfig = (template as any)?.template_config as TemplateConfig | null;
    const basePdf = templateConfig?.assets?.base_pdf;
    if (!basePdf?.storage_bucket || !basePdf?.storage_path) {
      return res.status(400).json({ error: 'template_missing_base_pdf' });
    }

    const basePdfBytes = await downloadBytes(basePdf.storage_bucket, basePdf.storage_path);
    const fontsByName: Record<string, Uint8Array> = {};
    const fontEntries = templateConfig?.fonts ? Object.entries(templateConfig.fonts) : [];
    for (const [fontName, fontCfg] of fontEntries) {
      if (!fontCfg?.storage_bucket || !fontCfg?.storage_path) continue;
      fontsByName[fontName] = await downloadBytes(fontCfg.storage_bucket, fontCfg.storage_path);
    }

    const resumeData = (resume as any)?.generated_resume_json || {};

    let photoPngBytes: Uint8Array | null = null;
    if (templateConfig?.photo?.enabled) {
      let resumePhotoUrl = String((resumeData as any)?.resume_photo_url || '').trim();
      let profilePhotoUrl = String((resumeData as any)?.profile_photo_url || '').trim();

      if (!profilePhotoUrl) {
        const { data: userRow } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', userId)
          .maybeSingle();
        profilePhotoUrl = String((userRow as any)?.avatar_url || '').trim();
      }

      const photoUrl = resumePhotoUrl || profilePhotoUrl;
      if (photoUrl) {
        const photoBytes = await downloadPhotoBytes(photoUrl);
        if (photoBytes) {
          const box = templateConfig.photo?.box;
          const targetSize = Math.round(box?.w || box?.h || 0);
          if (box?.shape === 'circle' && targetSize > 0) {
            photoPngBytes = await circleMaskPng(photoBytes, targetSize);
          } else {
            const normalized = await sharp(Buffer.from(photoBytes)).png().toBuffer();
            photoPngBytes = new Uint8Array(normalized);
          }
        }
      }
    }

    const rendered = await renderResumePdf({
      basePdfBytes,
      templateConfig: templateConfig || {},
      resumeData,
      fontsByName,
      photoPngBytes,
      debug,
    });

    const exportBucket = 'resume-exports';
    const resolvedSlug = String((template as any)?.slug || templateSlug || '').trim();
    const hash = createHash('sha256')
      .update(JSON.stringify({ resumeId, templateSlug: resolvedSlug, debug, updatedAt: Date.now() }))
      .digest('hex')
      .slice(0, 12);
    const exportPath = `user/${userId}/${resumeId}/${hash}.pdf`;
    const uploaded = await uploadBytes(exportBucket, exportPath, rendered, 'application/pdf');
    const pdfUrl = await getSignedUrl(exportBucket, uploaded.path, 60 * 60);

    res.json({ pdfUrl });
  } catch (e: any) {
    console.error('resume export error', e);
    res.status(500).json({ error: e?.message || 'export_failed' });
  }
});

export default router;
