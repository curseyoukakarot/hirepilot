import React, { useEffect, useMemo, useState } from 'react';
import useFormBuilder from '../../components/forms/hooks/useFormBuilder';
import Palette from '../../components/forms/builder/Palette';
import Canvas from '../../components/forms/builder/Canvas';
import Inspector from '../../components/forms/builder/Inspector';
import Topbar from '../../components/forms/builder/Topbar';
import EmbedModal from '../../components/forms/builder/EmbedModal';
import { listCustomTables, listJobReqs, publishForm, updateForm } from '../../lib/api/forms';
import '../../styles/forms.css';

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
            onPreview={() => window.open(`/f/${form?.slug}`, '_blank')}
            onShare={() => setEmbedOpen(true)}
            onPublish={async () => { if (form?.id) { const upd = await publishForm(form.id, true); setForm(upd); } }}
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


