import React, { useEffect, useMemo, useState } from 'react';
import useFormBuilder from '../../components/forms/hooks/useFormBuilder';
import Palette from '../../components/forms/builder/Palette';
import Canvas from '../../components/forms/builder/Canvas';
import Inspector from '../../components/forms/builder/Inspector';
import Topbar from '../../components/forms/builder/Topbar';
import EmbedModal from '../../components/forms/builder/EmbedModal';
import { listCustomTables, listJobReqs, publishForm, updateForm, upsertFields } from '../../lib/api/forms';
import '../../styles/forms.css';
import { toast } from 'react-hot-toast';

export default function FormBuilderPage() {
  const id = useMemo(() => {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1];
  }, []);
  const { form, setForm, fields, setFields, selected, setSelectedId, addField, duplicateField, deleteField, saving, dirty } = useFormBuilder(id);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [jobReqs, setJobReqs] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const t = await listCustomTables();
        setTables(Array.isArray(t?.items) ? t.items : []);
      } catch {}
      try {
        const j = await listJobReqs();
        setJobReqs(Array.isArray(j?.items) ? j.items : []);
      } catch {}
    })();
  }, []);

  const status: 'saved'|'saving'|'dirty' = saving ? 'saving' : dirty ? 'dirty' : 'saved';

  function buildPreviewHTML() {
    const esc = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fieldBlocks = (fields || []).map((f: any) => {
      const label = esc(f.label || 'Field');
      const required = f.required ? '<span class="ml-2 text-xs text-white/40">Required</span>' : '';
      const baseWrap = '<div class="field-card rounded-2xl border border-white/10 bg-hp-surface/50 backdrop-blur p-6">';
      const endWrap = '</div>';
      switch (f.type) {
        case 'short_text':
        case 'email':
        case 'phone':
          return `${baseWrap}
            <label class="block text-sm font-medium mb-3">${label} ${required}</label>
            <input type="text" placeholder="Enter value" class="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover placeholder-white/40" />
          ${endWrap}`;
        case 'long_text':
          return `${baseWrap}
            <label class="block text-sm font-medium mb-3">${label} ${required}</label>
            <textarea placeholder="Enter value" class="w-full min-h-[120px] rounded-xl px-4 py-3 bg-black/20 border border-white/10 focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover placeholder-white/40 resize-none"></textarea>
          ${endWrap}`;
        case 'dropdown': {
          const opts = (f.options || []).map((o: any) => `<option>${esc(o?.label || o)}</option>`).join('');
          return `${baseWrap}
            <label class="block text-sm font-medium mb-3">${label} ${required}</label>
            <select class="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 cursor-pointer focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover">
              <option>Select…</option>${opts}
            </select>
          ${endWrap}`;
        }
        case 'multi_select': {
          const chips = (f.options || []).map((o: any) => `
            <label class="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
              <span class="text-sm">${esc(o?.label || o)}</span>
            </label>`).join('');
          return `${baseWrap}
            <label class="block text-sm font-medium mb-3">${label} ${required}</label>
            <div class="grid grid-cols-2 gap-3">${chips}</div>
          ${endWrap}`;
        }
        case 'checkbox':
          return `${baseWrap}
            <label class="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" class="w-4 h-4 text-hp-primary bg-black/20 border-white/10 rounded focus:ring-hp-primary/20">
              <span class="text-sm">${label}</span>
            </label>
          ${endWrap}`;
        case 'date':
          return `${baseWrap}
            <label class="block text-sm font-medium mb-3">${label} ${required}</label>
            <input type="date" class="w-full h-12 px-4 rounded-xl bg-black/20 border border-white/10 focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover" />
          ${endWrap}`;
        case 'rating':
          return `${baseWrap}
            <label class="block text-sm font-medium mb-3">${label} ${required}</label>
            <input type="number" min="1" max="5" class="w-24 h-12 px-3 rounded-xl bg-black/20 border border-white/10 focus:border-hp-primary focus:ring-4 focus:ring-hp-primary/20 transition-all glow-hover" />
          ${endWrap}`;
        case 'file_upload':
          return `${baseWrap}
            <label class="block text-sm font-medium mb-3">${label} ${required}</label>
            <div class="file-drop-zone rounded-xl p-8 text-center cursor-pointer">
              <i class="fa-solid fa-cloud-arrow-up text-3xl text-hp-primary mb-3"></i>
              <p class="text-sm text-hp-text-muted mb-2">Drag and drop file here, or click to browse</p>
              <p class="text-xs text-white/40">PDF, DOC, DOCX up to 10MB</p>
            </div>
          ${endWrap}`;
        default:
          return '';
      }
    }).join('\\n');
    const title = esc(form?.title || 'Untitled Form');
    const desc = esc(form?.description || '');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset=\\"UTF-8\\">
  <meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1.0\\">
  <title>Preview</title>
  <script src=\\"https://cdn.tailwindcss.com\\"></script>
  <script>tailwind.config = { theme: { extend: { colors: { 'hp-bg':'#0a0a0a','hp-surface':'#1a1a1a','hp-primary':'#5b8cff','hp-primary-2':'#4a7bef','hp-text-muted':'#a0a0a0','hp-success':'#00d084' }}}}</script>
  <script> window.FontAwesomeConfig = { autoReplaceSvg: 'nest'};</script>
  <script src=\\"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js\\" crossorigin=\\"anonymous\\"></script>
  <link href=\\"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap\\" rel=\\"stylesheet\\">
  <style>
    *{font-family:'Inter',sans-serif}::-webkit-scrollbar{display:none}.field-card{opacity:0;transform:translateY(20px);animation:slideUp .6s ease-out forwards}.field-card:nth-child(2){animation-delay:.1s}.field-card:nth-child(3){animation-delay:.2s}.field-card:nth-child(4){animation-delay:.3s}.field-card:nth-child(5){animation-delay:.4s}.field-card:nth-child(6){animation-delay:.5s}@keyframes slideUp{to{opacity:1;transform:translateY(0)}}.progress-bar{transition:width .3s ease-out}.glow-hover{transition:all .3s ease}.glow-hover:hover{box-shadow:0 0 20px rgba(91,140,255,.3)}.file-drop-zone{border:2px dashed rgba(255,255,255,.1);transition:all .3s ease}.file-drop-zone:hover{border-color:rgba(91,140,255,.5);background:rgba(91,140,255,.05)}
  </style>
</head>
<body class=\\"bg-hp-bg text-white\\">
  <div id=\\"main-container\\" class=\\"min-h-screen w-full flex flex-col items-center py-14 px-6\\">
    <div id=\\"form-wrapper\\" class=\\"max-w-[700px] w-full\\">
      <div id=\\"progress-section\\" class=\\"mb-10\\">
        <div class=\\"h-1 w-full bg-white/5 rounded-full overflow-hidden\\">
          <div id=\\"progress-fill\\" class=\\"h-full bg-hp-primary progress-bar\\" style=\\"width: 30%\\"></div>
        </div>
      </div>
      <div id=\\"hero-section\\" class=\\"text-center mb-12\\">
        <div class=\\"h-10 mx-auto mb-6 opacity-80 w-10 bg-hp-primary rounded-lg flex items-center justify-center\\">
          <i class=\\"fa-solid fa-rocket text-white text-lg\\"></i>
        </div>
        <h1 class=\\"text-3xl font-semibold mb-3\\">${title}</h1>
        ${desc ? `<p class=\\"text-hp-text-muted text-lg\\">${desc}</p>` : ''}
      </div>
      <form class=\\"space-y-6\\">
        ${fieldBlocks}
        <div class=\\"field-card\\">
          <button type=\\"button\\" class=\\"w-full h-14 mt-8 rounded-xl bg-hp-primary text-white font-semibold text-lg hover:bg-hp-primary-2 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(91,140,255,.5)] active:scale-[0.97]\\">
            <span class=\\"flex items-center justify-center space-x-2\\"><span>Submit</span><i class=\\"fa-solid fa-arrow-right\\"></i></span>
          </button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
  }

  return (
    <div className="min-h-screen flex bg-[var(--hp-bg)] text-[var(--hp-text)]">
      {/* Left Palette */}
      <div className="w-72 bg-[var(--hp-surface)] border-r border-[var(--hp-border)] p-6 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-[15px] font-medium tracking-wide uppercase text-[var(--hp-text-muted)] mb-4">Form Fields</h3>
        </div>
        <Palette onAddField={addField} />
      </div>

      {/* Main content column */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-16 bg-[var(--hp-surface)] border-b border-[var(--hp-border)] px-6 flex items-center justify-between">
          <Topbar
            title={form?.title || 'Untitled Form'}
            status={status}
            onTitleChange={async (t) => {
              setForm((prev: any) => ({ ...(prev || {}), title: t }));
              if (form?.id) await updateForm(form.id, { title: t });
            }}
            onBack={() => { window.location.href = '/forms'; }}
            onSave={async () => {
              if (!form?.id) return;
              try {
                // Persist form metadata
                const patch: Record<string, any> = {};
                if (typeof form?.title === 'string') patch.title = form.title;
                if (typeof (form as any)?.description === 'string') patch.description = (form as any).description;
                if ((form as any)?.destination_type) patch.destination_type = (form as any).destination_type;
                if ((form as any)?.destination_target_id !== undefined) patch.destination_target_id = (form as any).destination_target_id;
                if ((form as any)?.job_req_id !== undefined) patch.job_req_id = (form as any).job_req_id;
                const updated = Object.keys(patch).length ? await updateForm(form.id, patch) : form;
                if (updated) setForm(updated);
                // Persist fields
                if (Array.isArray(fields)) {
                  const resp = await upsertFields(form.id, fields);
                  if (resp?.fields) {
                    setFields(resp.fields);
                  }
                }
                toast.success('Form saved');
              } catch (e: any) {
                toast.error(e?.message || 'Failed to save form');
              }
            }}
            onPreview={() => {
              const html = buildPreviewHTML();
              const w = window.open('', '_blank');
              if (w && html) { w.document.write(html); w.document.close(); }
            }}
            onShare={() => setEmbedOpen(true)}
            onPublish={async () => {
              if (!form?.id) return;
              try {
                // Save before publish to avoid losing latest edits
                const patch: Record<string, any> = {};
                if (typeof form?.title === 'string') patch.title = form.title;
                if (typeof (form as any)?.description === 'string') patch.description = (form as any).description;
                if ((form as any)?.destination_type) patch.destination_type = (form as any).destination_type;
                if ((form as any)?.destination_target_id !== undefined) patch.destination_target_id = (form as any).destination_target_id;
                if ((form as any)?.job_req_id !== undefined) patch.job_req_id = (form as any).job_req_id;
                if (Object.keys(patch).length) await updateForm(form.id, patch);
                if (Array.isArray(fields)) await upsertFields(form.id, fields);
                const upd = await publishForm(form.id, true);
                setForm(upd);
                const url = `${window.location.origin}/f/${upd.slug}`;
                try { await navigator.clipboard.writeText(url); } catch {}
                toast.success('Form published! Public link copied to clipboard.');
              } catch (e: any) {
                toast.error(e?.message || 'Failed to publish form');
              }
            }}
          />
        </div>

        {/* Canvas + Inspector */}
        <div className="flex-1 flex">
          <div className="flex-1 p-8 overflow-y-auto bg-[var(--hp-surface-2)]">
            <div className="max-w-2xl mx-auto">
              <Canvas
                fields={fields}
                selectedId={selected?.id || null}
                onSelect={(fid) => setSelectedId(fid)}
                onDuplicate={duplicateField}
                onDelete={deleteField}
              />
            </div>
          </div>
          <div className="w-80 bg-[var(--hp-surface)] border-l border-[var(--hp-border)] p-6 overflow-y-auto">
            <Inspector
              field={selected}
              onChange={(patch) => {
                setFields(prev => prev.map(f => f.id === selected?.id ? ({ ...f, ...patch }) : f));
              }}
              form={form}
              onFormChange={async (patch) => {
                if (!form?.id) return;
                const next = await updateForm(form.id, patch);
                setForm(next);
              }}
              tables={tables}
              jobReqs={jobReqs}
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="h-14 bg-[var(--hp-surface)] border-t border-[var(--hp-border)] px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-[var(--hp-text-muted)]">
            <span>
              {form?.destination_type === 'candidate'
                ? 'Submissions → Candidates'
                : form?.destination_type === 'lead'
                  ? 'Submissions → Leads'
                  : 'Submissions → Table'}
            </span>
            <div className="w-px h-4 bg-[var(--hp-border)]" />
            <button className="hover:text-[var(--hp-text)] transition-colors">Webhooks</button>
            <button className="hover:text-[var(--hp-text)] transition-colors">Zapier</button>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--hp-text-muted)]">{saving ? 'Saving…' : dirty ? 'Unsaved' : 'Auto-saved'}</span>
            {!saving && !dirty && <i className="fa-solid fa-check w-4 h-4 text-[var(--hp-success)]" />}
          </div>
        </div>
      </div>

      {form?.slug && <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={form.slug} />}
    </div>
  );
}


