import React, { useEffect, useState } from 'react';
import { getPublicFormBySlug, getUploadUrl, submitPublic } from '../../../lib/api/forms';
import RenderField from './FieldRenderers';

type Props = { slug: string };

export function PublicForm({ slug }: Props) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const f = await getPublicFormBySlug(slug);
        if (!mounted) return;
        setForm(f);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    // Prepare payload
    const payloadValues: any[] = [];
    for (const field of form.fields || []) {
      const v = values[field.id];
      if (field.type === 'file_upload' && v instanceof File) {
        // Upload via signed URL (token-based)
        const signed = await getUploadUrl({ filename: v.name, contentType: v.type || 'application/octet-stream' });
        const uploadResp = await fetch(`${(import.meta as any).env?.VITE_SUPABASE_URL}/storage/v1/object/upload/sign/${signed.bucket}/${signed.path}`, {
          method: 'POST',
          headers: { 'x-upsert': 'false' },
          body: (() => { const f = new FormData(); f.append('file', v); f.append('token', signed.token); return f; })(),
        });
        if (!uploadResp.ok) throw new Error('upload_failed');
        payloadValues.push({ field_id: field.id, file_url: `${(import.meta as any).env?.VITE_SUPABASE_URL}/storage/v1/object/${signed.bucket}/${signed.path}` });
      } else if (Array.isArray(v)) {
        payloadValues.push({ field_id: field.id, json_value: v });
      } else if (typeof v === 'object' && v !== null) {
        payloadValues.push({ field_id: field.id, json_value: v });
      } else {
        payloadValues.push({ field_id: field.id, value: v == null ? null : String(v) });
      }
    }
    await submitPublic(slug, { values: payloadValues, source: 'direct' });
    setSubmitted(true);
  }

  if (loading) return <div className="p-4">Loading…</div>;
  if (!form) return <div className="p-4">Form not found</div>;
  if (submitted) return <div className="p-8 text-center text-lg">Thank you! Your response has been recorded.</div>;

  return (
    <form className="max-w-2xl mx-auto p-4" onSubmit={handleSubmit}>
      <h1 className="text-2xl font-semibold mb-2">{form.title}</h1>
      {form.description && <p className="text-muted-foreground mb-4">{form.description}</p>}
      {(form.fields || []).map((field: any) => (
        <RenderField
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(v) => setValues(prev => ({ ...prev, [field.id]: v }))}
        />
      ))}
      <button className="px-3 py-2 bg-primary text-primary-foreground rounded" type="submit">Submit</button>
    </form>
  );
}

export default PublicForm;


