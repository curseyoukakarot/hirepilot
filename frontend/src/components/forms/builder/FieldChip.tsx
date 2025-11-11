import React from 'react';

type Props = {
  label: string;
  onAdd: () => void;
};

export function FieldChip({ label, onAdd }: Props) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="px-2 py-1 rounded-md border text-sm hover:bg-muted"
      aria-label={`Add ${label}`}
    >
      {label}
    </button>
  );
}

export default FieldChip;


