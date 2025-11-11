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
          <input
            type="text"
            placeholder={field.placeholder || 'Enter value'}
            className="hp-input w-full h-11 px-3 rounded-xl"
            readOnly
          />
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[var(--hp-text-muted)]" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicate">
            <i className="fa-solid fa-copy w-4 h-4"></i>
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[var(--hp-text-muted)]" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
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


