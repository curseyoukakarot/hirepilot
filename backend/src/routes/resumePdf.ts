import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import { chromium } from 'playwright';

const router = express.Router();

router.post('/pdf', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any)?.user?.id as string | undefined;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const { resume_json, draft_id } = (req.body || {}) as { resume_json?: any; draft_id?: string };
    if (!resume_json) return res.status(400).json({ error: 'resume_json required' });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="application/json" id="resume-data">${JSON.stringify(resume_json)}</script>
  <script>
    const data = JSON.parse(document.getElementById('resume-data').textContent || '{}');
    const root = document.getElementById('root');
    root.innerHTML = \`
      <style>
        @page { size: Letter; margin: 0.55in; }
        body { margin: 0; padding: 0; }
        .resume-page {
          font-family: "EB Garamond", Garamond, serif;
          font-size: 8pt;
          line-height: 1.25;
          color: #111827;
        }
        .contact-email { font-size: 12pt; font-weight: 600; margin-bottom: 2pt; }
        .contact-linkedin { font-size: 10pt; margin-bottom: 10pt; }
        .section-title{
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #365F91;
          margin: 10pt 0 4pt;
        }
        .role-header { font-weight: 700; margin-top: 8pt; }
        .role-why { margin: 3pt 0 4pt; }
        ul { margin: 0; padding-left: 14pt; }
        li { margin: 0 0 2pt 0; }
      </style>
      <div class="resume-page">
        <div class="contact-email">\${(data.contact && data.contact.email) || ''}</div>
        <div class="contact-linkedin">\${(data.contact && data.contact.linkedin) || ''}</div>
        \${(data.skills && data.skills.length) ? \`
          <div class="section-title">Skills</div>
          <div>\${data.skills.join(' • ')}</div>\` : ''}
        \${(data.education && data.education.length) ? \`
          <div class="section-title">Education & Certifications</div>
          \${data.education.map((e) => '<div>'+e+'</div>').join('')}\` : ''}
        \${(data.experience && data.experience.length) ? \`
          <div class="section-title">Professional Experience</div>
          \${data.experience.map((r) => \`
            <div>
              <div class="role-header">\${r.company || ''} | \${r.title || ''} \${r.dates ? ' ' + r.dates : ''}</div>
              \${r.whyHiredSummary ? '<div class="role-why">'+r.whyHiredSummary+'</div>' : ''}
              \${(r.bullets && r.bullets.length) ? '<ul>' + r.bullets.map((b) => '<li>'+b+'</li>').join('') + '</ul>' : ''}
            </div>
          \`).join('')}\` : ''}
      </div>
    \`;
  </script>
</body>
</html>
    `;

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 850, height: 1100 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.55in', right: '0.55in', bottom: '0.55in', left: '0.55in' } });
    await browser.close();

    // upload to supabase storage
    const bucket = process.env.SUPABASE_RESUME_PDF_BUCKET || 'resume-pdfs';
    try {
      const { data: bucketInfo } = await (supabase as any).storage.getBucket(bucket);
      if (!bucketInfo) {
        await (supabase as any).storage.createBucket(bucket, { public: true });
      }
    } catch (err) {
      // proceed to upload attempt; createBucket may fail if already exists
    }

    const fileName = `resume_pdf_${Date.now()}.pdf`;
    const { data: uploaded, error } = await (supabase as any).storage
      .from(bucket)
      .upload(`user/${userId}/${fileName}`, pdfBuffer, { contentType: 'application/pdf', upsert: false });
    if (error) throw error;
    const { data: pub } = (supabase as any).storage.from(bucket).getPublicUrl(uploaded.path);

    // Optionally store on draft
    if (draft_id) {
      try {
        await supabase.from('job_resume_drafts').update({ pdf_url: pub?.publicUrl || null }).eq('id', draft_id).eq('user_id', userId);
      } catch {}
    }

    res.json({ url: pub?.publicUrl || null });
  } catch (e: any) {
    console.error('resume pdf error', e);
    res.status(500).json({ error: e?.message || 'pdf_failed' });
  }
});

export default router;

