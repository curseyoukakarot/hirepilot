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

    // Resolve the user's selected resume template (default to ATS-safe classic)
    let selectedTemplate: any = null;
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
        selectedTemplate = tpl || null;
      }
      if (!selectedTemplate) {
        const { data: fallback } = await supabase
          .from('resume_templates')
          .select('id,name,slug,template_config,is_ats_safe,is_one_page')
          .eq('slug', 'ats_safe_classic')
          .maybeSingle();
        selectedTemplate = fallback || null;
      }
    } catch {
      // Non-blocking: default template rendering below will be used
      selectedTemplate = null;
    }

    const templateConfig = (selectedTemplate as any)?.template_config || {};
    const templateMeta = {
      id: (selectedTemplate as any)?.id || null,
      name: (selectedTemplate as any)?.name || 'ATS-Safe Classic',
      slug: (selectedTemplate as any)?.slug || 'ats_safe_classic',
      is_ats_safe: Boolean((selectedTemplate as any)?.is_ats_safe ?? true),
      is_one_page: Boolean((selectedTemplate as any)?.is_one_page ?? true),
    };

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
  <script type="application/json" id="template-config">${JSON.stringify(templateConfig || {})}</script>
  <script type="application/json" id="template-meta">${JSON.stringify(templateMeta)}</script>
  <script>
    const data = JSON.parse(document.getElementById('resume-data').textContent || '{}');
    const cfg = JSON.parse(document.getElementById('template-config').textContent || '{}');
    const meta = JSON.parse(document.getElementById('template-meta').textContent || '{}');
    const root = document.getElementById('root');
    const fontFamily = cfg.fontFamily || '"EB Garamond", Garamond, serif';
    const accent = cfg.accentColor || '#365F91';
    const baseFontPt = (typeof cfg.baseFontPt === 'number' ? cfg.baseFontPt : 8);
    const nameFontPt = (typeof cfg.nameFontPt === 'number' ? cfg.nameFontPt : 18);
    const layout = cfg.layout || 'single';
    const experienceStyle = cfg.experienceStyle || 'default';
    const sidebarSections = Array.isArray(cfg.sidebarSections) ? cfg.sidebarSections : ['summary','skills'];
    const sectionOrder = Array.isArray(cfg.sectionOrder) ? cfg.sectionOrder : ['summary','skills','education','experience'];

    const sections = {
      summary: () => data.summary ? \`
        <div class="section-title">Summary</div>
        <div>\${data.summary}</div>
      \` : '',
      skills: () => (data.skills && data.skills.length) ? \`
        <div class="section-title">Skills</div>
        <div>\${data.skills.join(' • ')}</div>
      \` : '',
      education: () => (data.education && data.education.length) ? \`
        <div class="section-title">Education & Certifications</div>
        \${data.education.map((e) => '<div>'+e+'</div>').join('')}
      \` : '',
      experience: () => (data.experience && data.experience.length) ? \`
        <div class="section-title">Professional Experience</div>
        \${data.experience
          .filter((r) => r && r.included !== false)
          .map((r) => \`
          <div class="role \${experienceStyle === 'timeline' ? 'role-timeline' : ''}">
            <div class="role-header">\${r.company || ''} | \${r.title || ''} \${r.dates ? ' ' + r.dates : ''}</div>
            \${r.whyHiredSummary ? '<div class="role-why">'+r.whyHiredSummary+'</div>' : ''}
            \${(r.bullets && r.bullets.length) ? '<ul>' + r.bullets.map((b) => '<li>'+b+'</li>').join('') + '</ul>' : ''}
          </div>
        \`).join('')}
      \` : ''
    };

    function renderOrdered(keys) {
      return (keys || []).map((k) => (sections[k] ? sections[k]() : '')).join('');
    }

    const sidebarKeys = (layout === 'twoColumn') ? sectionOrder.filter(k => sidebarSections.includes(k)) : [];
    const mainKeys = (layout === 'twoColumn') ? sectionOrder.filter(k => !sidebarSections.includes(k)) : sectionOrder;

    root.innerHTML = \`
      <style>
        @page { size: Letter; margin: 0.55in; }
        body { margin: 0; padding: 0; }
        .resume-page {
          font-family: \${fontFamily};
          font-size: \${baseFontPt}pt;
          line-height: 1.25;
          color: #111827;
        }
        .name { font-size: \${nameFontPt}pt; font-weight: 700; margin-bottom: 6pt; }
        .contact-email { font-size: 12pt; font-weight: 600; margin-bottom: 2pt; }
        .contact-linkedin { font-size: 10pt; margin-bottom: 10pt; }
        .section-title{
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: \${accent};
          margin: 10pt 0 4pt;
        }
        .layout.two-col{
          display: grid;
          grid-template-columns: 1fr 0.55fr;
          gap: 14pt;
          align-items: start;
        }
        .sidebar{
          border-left: 1px solid rgba(17,24,39,.12);
          padding-left: 10pt;
        }
        .role-header { font-weight: 700; margin-top: 8pt; }
        .role-why { margin: 3pt 0 4pt; }
        ul { margin: 0; padding-left: 14pt; }
        li { margin: 0 0 2pt 0; }
        .role-timeline{
          border-left: 2px solid rgba(16,185,129,.25);
          padding-left: 8pt;
          margin-left: 2pt;
        }
      </style>
      <div class="resume-page">
        <div class="name">\${(data.contact && data.contact.name) || ''}</div>
        <div class="contact-email">\${(data.contact && data.contact.email) || ''}</div>
        <div class="contact-linkedin">\${(data.contact && data.contact.linkedin) || ''}</div>

        \${layout === 'twoColumn' ? \`
          <div class="layout two-col">
            <div class="main">\${renderOrdered(mainKeys)}</div>
            <aside class="sidebar">\${renderOrdered(sidebarKeys)}</aside>
          </div>
        \` : \`
          \${renderOrdered(mainKeys)}
        \`}
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

