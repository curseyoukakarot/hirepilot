import React from 'react';

export function RenderField({ field, value, onChange }: { field: any; value: any; onChange: (v: any) => void }) {
  const id = `f_${field.id}`;
  switch (field.type) {
    case 'short_text':
    case 'email':
      return (
        <div className="mb-3">
          <label htmlFor={id} className="block text-sm mb-1">{field.label}</label>
          <input id={id} className="w-full border rounded px-2 py-1" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'long_text':
      return (
        <div className="mb-3">
          <label htmlFor={id} className="block text-sm mb-1">{field.label}</label>
          <textarea id={id} className="w-full border rounded px-2 py-1" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'checkbox':
      return (
        <div className="mb-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
            <span>{field.label}</span>
          </label>
        </div>
      );
    case 'dropdown':
      return (
        <div className="mb-3">
          <label htmlFor={id} className="block text-sm mb-1">{field.label}</label>
          <select id={id} className="w-full border rounded px-2 py-1" value={value || ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {(field.options || [])?.map((opt: any, idx: number) => (
              <option key={idx} value={opt?.value || opt}>{opt?.label || String(opt)}</option>
            ))}
          </select>
        </div>
      );
    case 'file_upload':
      return (
        <div className="mb-3">
          <label className="block text-sm mb-1">{field.label}</label>
          <input type="file" onChange={(e) => onChange((e.target as HTMLInputElement).files?.[0] || null)} />
        </div>
      );
    case 'date':
      return (
        <div className="mb-3">
          <label htmlFor={id} className="block text-sm mb-1">{field.label}</label>
          <input id={id} type="date" className="w-full border rounded px-2 py-1" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'rating':
      return (
        <div className="mb-3">
          <label className="block text-sm mb-1">{field.label}</label>
          <input type="number" min={1} max={5} className="w-24 border rounded px-2 py-1" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    default:
      return null;
  }
}

export default RenderField;


