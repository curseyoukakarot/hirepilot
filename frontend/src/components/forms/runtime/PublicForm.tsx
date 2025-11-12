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
    const payloadValues: any[] = [];
    for (const field of form.fields || []) {
      const v = values[field.id];
      if (field.type === 'file_upload' && v instanceof File) {
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
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="max-w-md text-center">
          <div className="text-[#00d084] text-6xl mb-4"><i className="fa-solid fa-circle-check"></i></div>
          <h2 className="text-3xl font-semibold mb-2">Thank you!</h2>
          <p className="text-[#a0a0a0]">Your response has been submitted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="h-10 mx-auto mb-6 opacity-80 w-10 bg-[#5b8cff] rounded-lg flex items-center justify-center">
            <i className="fa-solid fa-rocket text-white text-lg"></i>
          </div>
          <h1 className="text-3xl font-semibold mb-3">{form.title}</h1>
          {form.description && <p className="text-[#a0a0a0] text-lg">{form.description}</p>}
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {(form.fields || []).map((field: any) => (
            <div key={field.id} className="rounded-2xl border border-white/10 bg-[#1a1a1a]/50 backdrop-blur p-6">
              <RenderField
                field={field}
                value={values[field.id]}
                onChange={(v) => setValues(prev => ({ ...prev, [field.id]: v }))}
              />
            </div>
          ))}
          <div className="field-card">
            <button
              type="submit"
              className="w-full h-14 mt-6 rounded-xl bg-[#5b8cff] text-white font-semibold text-lg hover:bg-[#4a7bef] transition-all shadow-lg hover:shadow-[0_0_20px_rgba(91,140,255,.5)] active:scale-[0.97]"
            >
              <span className="flex items-center justify-center space-x-2">
                <span>Submit</span>
                <i className="fa-solid fa-arrow-right" />
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PublicForm;
