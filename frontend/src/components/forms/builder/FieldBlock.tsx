import React from 'react';
import type { BuilderField } from '../types';

type Props = {
  field: BuilderField;
  isSelected?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function FieldBlock({ field, isSelected, onSelect, onDuplicate, onDelete }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className={`border rounded-md p-3 mb-2 ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{field.label}</div>
        <div className="flex gap-2">
          <button className="text-xs underline" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>Duplicate</button>
          <button className="text-xs text-destructive underline" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Delete</button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{field.type}</div>
    </div>
  );
}

export default FieldBlock;


