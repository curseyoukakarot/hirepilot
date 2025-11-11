import React from 'react';
import FieldChip from './FieldChip';
import type { BuilderField } from '../types';

type Props = {
  onAddField: (type: BuilderField['type']) => void;
};

const PALETTE: { label: string; type: BuilderField['type']; icon: string; desc: string }[] = [
  { label: 'Short Text', type: 'short_text', icon: 'fa-solid fa-font', desc: 'Single line input' },
  { label: 'Long Text', type: 'long_text', icon: 'fa-solid fa-align-left', desc: 'Multi-line textarea' },
  { label: 'Email', type: 'email', icon: 'fa-solid fa-envelope', desc: 'Email validation' },
  { label: 'Phone', type: 'phone', icon: 'fa-solid fa-phone', desc: 'Phone number input' },
  { label: 'Dropdown', type: 'dropdown', icon: 'fa-solid fa-chevron-down', desc: 'Single select' },
  { label: 'Multi-Select', type: 'multi_select', icon: 'fa-solid fa-list-check', desc: 'Multiple options' },
  { label: 'Checkbox', type: 'checkbox', icon: 'fa-solid fa-square-check', desc: 'True/false toggle' },
  { label: 'Date', type: 'date', icon: 'fa-solid fa-calendar', desc: 'Date picker' },
  { label: 'Rating', type: 'rating', icon: 'fa-solid fa-star', desc: 'Star rating' },
  { label: 'File Upload', type: 'file_upload', icon: 'fa-solid fa-upload', desc: 'File attachment' },
];

export function Palette({ onAddField }: Props) {
  return (
    <div id="field-palette" className="space-y-3">
      {PALETTE.map(p => (
        <div
          key={p.type}
          className="field-chip hp-card rounded-xl p-3 cursor-grab hover:bg-slate-50 dark:hover:bg-gray-800 transition-all duration-150"
          draggable={false}
          onClick={() => onAddField(p.type)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onAddField(p.type); }}
        >
          <div className="flex items-center gap-3">
            <i className={`${p.icon} w-5 h-5 text-[var(--hp-primary)]`}></i>
            <div>
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-xs text-[var(--hp-text-muted)]">{p.desc}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Palette;


