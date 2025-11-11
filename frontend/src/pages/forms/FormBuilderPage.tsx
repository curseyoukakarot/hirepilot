import React, { useEffect, useMemo, useState } from 'react';
import useFormBuilder from '../../components/forms/hooks/useFormBuilder';
import Palette from '../../components/forms/builder/Palette';
import Canvas from '../../components/forms/builder/Canvas';
import Inspector from '../../components/forms/builder/Inspector';
import Topbar from '../../components/forms/builder/Topbar';
import EmbedModal from '../../components/forms/builder/EmbedModal';
import { listCustomTables, listJobReqs, publishForm, updateForm } from '../../lib/api/forms';

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
    <div className="flex flex-col h-full">
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
      <div className="flex flex-1">
        <Palette onAddField={addField} />
        <Canvas
          fields={fields}
          selectedId={selected?.id || null}
          onSelect={(fid) => setSelectedId(fid)}
          onDuplicate={duplicateField}
          onDelete={deleteField}
        />
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
      {form?.slug && <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} slug={form.slug} />}
    </div>
  );
}


