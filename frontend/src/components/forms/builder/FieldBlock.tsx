import React from 'react';
import type { BuilderField } from '../types';
import { motion } from 'framer-motion';
import { slideUp } from '../../../lib/motion';

type Props = {
  field: BuilderField;
  isSelected?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function FieldBlock({ field, isSelected, onSelect, onDuplicate, onDelete }: Props) {
  const opts = (field.options || {}) as any;

  function renderPreview() {
    switch (field.type) {
      case 'dropdown': {
        const choices: string[] = Array.isArray(opts.choices) ? opts.choices : ['Option 1', 'Option 2'];
        return (
          <select className="hp-input w-full h-11 px-3 rounded-xl">
            <option value="">{field.placeholder || 'Select…'}</option>
            {choices.map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
        );
      }
      case 'multi_select': {
        const choices: string[] = Array.isArray(opts.choices) ? opts.choices : ['Alpha', 'Beta', 'Gamma'];
        return (
          <div className="hp-input w-full rounded-xl px-2 py-2">
            <div className="flex flex-wrap gap-2">
              {choices.slice(0, 3).map((c, i) => (
                <span key={i} className="px-2 py-1 text-xs rounded-lg bg-[var(--hp-surface-2)]">{c}</span>
              ))}
              <span className="text-xs text-[var(--hp-text-muted)]">{choices.length > 3 ? `+${choices.length - 3} more` : ''}</span>
            </div>
          </div>
        );
      }
      case 'checkbox': {
        const def = !!opts.defaultChecked;
        return (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" defaultChecked={def} className="rounded border-[var(--hp-border)]" readOnly />
            <span className="text-sm">{field.placeholder || 'Checkbox'}</span>
          </label>
        );
      }
      case 'date': {
        return (
          <input
            type="date"
            className="hp-input w-full h-11 px-3 rounded-xl"
            readOnly
          />
        );
      }
      case 'rating': {
        const max = Math.max(1, Math.min(Number(opts.max || 5), 10));
        return (
          <div className="flex items-center gap-1 text-[#5b8cff]">
            {Array.from({ length: max }).map((_, i) => (
              <i key={i} className="fa-solid fa-star"></i>
            ))}
          </div>
        );
      }
      case 'calendly': {
        const url = opts.url || '';
        return (
          <div className="hp-input w-full rounded-xl px-3 py-3 text-sm text-[var(--hp-text-muted)]">
            {url ? (
              <div className="flex items-center gap-2"><i className="fa-solid fa-calendar-check text-[var(--hp-primary)]"></i> Calendly embed: {url}</div>
            ) : (
              <span>Calendly will render here (set URL in inspector)</span>
            )}
          </div>
        );
      }
      case 'file_upload': {
        return (
          <div className="drop-zone rounded-xl p-4">
            <div className="flex items-center gap-3 text-[var(--hp-text-muted)]">
              <i className="fa-solid fa-upload text-[#5b8cff]"></i>
              <span className="text-sm">Upload a file</span>
            </div>
          </div>
        );
      }
      default: {
        return (
          <input
            type={field.type === 'email' ? 'email' : 'text'}
            placeholder={field.placeholder || 'Enter value'}
            className="hp-input w-full h-11 px-3 rounded-xl"
            readOnly
          />
        );
      }
    }
  }

  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="show"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className={`field-block hp-card rounded-2xl p-6 ${isSelected ? 'border-l-4 border-l-[var(--hp-primary)]' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">{field.label || 'Untitled'}</label>
          {renderPreview()}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center justify-center text-[var(--hp-text-muted)]" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicate">
            <i className="fa-solid fa-copy w-4 h-4"></i>
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 flex items-center justify-center text-[var(--hp-text-muted)]" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
            <i className="fa-solid fa-trash w-4 h-4"></i>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--hp-text-muted)]">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!field.required} readOnly className="rounded border-[var(--hp-border)]" />
          Required
        </label>
        <span className="capitalize">{field.type}</span>
      </div>
    </motion.div>
  );
}

export default FieldBlock;


