import React from 'react';

export function RenderField({ field, value, onChange }: { field: any; value: any; onChange: (v: any) => void }) {
  const id = `f_${field.id}`;
  const optionContainer = (field && field.options) || {};
  const extractChoices = (): any[] => {
    if (Array.isArray((optionContainer as any).choices)) return (optionContainer as any).choices;
    if (Array.isArray(field.options)) return field.options as any[];
    return [];
  };
  switch (field.type) {
    case 'short_text':
    case 'phone':
    case 'email':
      return (
        <div className="mb-3">
          <label htmlFor={id} className="block text-sm mb-1">{field.label}</label>
          <input
            id={id}
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
            className="w-full border rounded px-2 py-1"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
          />
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
            {extractChoices().map((opt: any, idx: number) => (
              <option key={idx} value={opt?.value ?? opt}>{opt?.label ?? String(opt)}</option>
            ))}
          </select>
        </div>
      );
    case 'multi_select': {
      const opts: any[] = extractChoices();
      const selected: any[] = Array.isArray(value) ? value : [];
      const toggle = (opt: any) => {
        const val = opt?.value ?? opt;
        const label = opt?.label ?? String(opt);
        const exists = selected.find((v) => (v?.value ?? v) === val);
        if (exists) {
          onChange(selected.filter((v) => (v?.value ?? v) !== val));
        } else {
          onChange([...selected, opt?.value ? { value: val, label } : val]);
        }
      };
      return (
        <div className="mb-3">
          <label className="block text-sm mb-2">{field.label}</label>
          <div className="flex flex-wrap gap-2">
            {opts.map((opt, i) => {
              const val = opt?.value ?? opt;
              const label = opt?.label ?? String(opt);
              const isOn = selected.some((v) => (v?.value ?? v) === val);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`px-3 py-1 rounded-lg text-sm border ${isOn ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-current'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
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


