import React from 'react';
import FieldChip from './FieldChip';
import type { BuilderField } from '../types';

type Props = {
  onAddField: (type: BuilderField['type']) => void;
};

const PALETTE: { label: string; type: BuilderField['type'] }[] = [
  { label: 'Short Text', type: 'short_text' },
  { label: 'Long Text', type: 'long_text' },
  { label: 'Email', type: 'email' },
  { label: 'Dropdown', type: 'dropdown' },
  { label: 'Checkbox', type: 'checkbox' },
  { label: 'File Upload', type: 'file_upload' },
  { label: 'Date', type: 'date' },
  { label: 'Rating', type: 'rating' },
];

export function Palette({ onAddField }: Props) {
  return (
    <div className="p-3 border-r min-w-[220px]">
      <div className="font-semibold mb-3">Fields</div>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map(p => (
          <FieldChip key={p.type} label={p.label} onAdd={() => onAddField(p.type)} />
        ))}
      </div>
    </div>
  );
}

export default Palette;


