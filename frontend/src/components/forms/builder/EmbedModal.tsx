import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  backendBase?: string;
};

export function EmbedModal({ open, onClose, slug, backendBase }: Props) {
  if (!open) return null;
  const base = backendBase || (import.meta as any).env?.VITE_BACKEND_URL || '';
  const src = `${base}/f/${slug}`;
  const iframe = `<iframe src="${src}" style="width:100%;height:600px;border:0;" allow="clipboard-write *"></iframe>`;
  const script = `<script async src="${base}/forms/embed.js" data-form="${slug}"></script>`;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-background rounded-md shadow-lg w-full max-w-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Embed Form</div>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>
        <div className="text-sm mb-2">Iframe</div>
        <textarea className="w-full h-24 border rounded p-2 text-xs" readOnly value={iframe} />
        <div className="text-sm mt-4 mb-2">Script</div>
        <textarea className="w-full h-24 border rounded p-2 text-xs" readOnly value={script} />
      </div>
    </div>
  );
}

export default EmbedModal;


