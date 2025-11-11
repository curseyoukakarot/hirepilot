import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  response: any | null;
  values: any[];
};

export function ResponseDrawer({ open, onClose, response, values }: Props) {
  if (!open || !response) return null;
  return (
    <div className="fixed inset-0 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-[420px] bg-background border-l p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Submission</div>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>
        <div className="text-xs text-muted-foreground mb-2">{new Date(response.submitted_at).toLocaleString()}</div>
        <div className="space-y-2">
          {values.map((v: any, idx: number) => (
            <div key={idx} className="text-sm">
              {v.file_url ? (
                <a href={v.file_url} target="_blank" rel="noreferrer" className="underline">Attachment</a>
              ) : (
                <span>{v.value || (v.json_value ? JSON.stringify(v.json_value) : '')}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ResponseDrawer;


