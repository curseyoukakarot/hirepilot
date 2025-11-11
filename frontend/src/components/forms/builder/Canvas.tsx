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
    <div className="flex-1 p-4">
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
      {fields.length === 0 && (
        <div className="text-sm text-muted-foreground">Add a field from the left to get started.</div>
      )}
    </div>
  );
}

export default Canvas;


