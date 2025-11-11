import React from 'react';
import FieldBlock from './FieldBlock';
import type { BuilderField } from '../types';

type Props = {
  fields: BuilderField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function Canvas({ fields, selectedId, onSelect, onDuplicate, onDelete }: Props) {
  return (
    <div className="space-y-6">
      <div id="form-header" className="mb-2">
        <input type="text" placeholder="Form Title" className="hp-input w-full h-12 px-4 rounded-xl text-2xl font-semibold border-dashed" />
        <textarea placeholder="Form description (optional)" className="hp-input w-full mt-4 p-4 rounded-xl border-dashed resize-none" rows={2}></textarea>
      </div>

      {fields.length === 0 && (
        <div className="drop-zone rounded-2xl p-6 text-center text-[var(--hp-text-muted)]">
          <i className="fa-solid fa-plus w-8 h-8 mx-auto mb-3 text-slate-300"></i>
          <p className="text-sm">Drag fields from the left panel to start building your form</p>
        </div>
      )}

      {fields.map((f) => (
        <FieldBlock
          key={f.id}
          field={f}
          isSelected={selectedId === f.id}
          onSelect={() => onSelect(f.id)}
          onDuplicate={() => onDuplicate(f.id)}
          onDelete={() => onDelete(f.id)}
        />
      ))}

      <div className="drop-zone rounded-2xl p-4 text-center text-[var(--hp-text-muted)] border-dashed">
        <i className="fa-solid fa-plus w-6 h-6 mx-auto mb-2 text-[var(--hp-border)]"></i>
        <p className="text-xs">Drop field here</p>
      </div>
    </div>
  );
}

export default Canvas;


