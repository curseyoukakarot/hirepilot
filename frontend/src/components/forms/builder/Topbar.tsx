import React from 'react';

type Props = {
  title: string;
  status: 'saved' | 'saving' | 'dirty';
  onTitleChange: (t: string) => void;
  onBack?: () => void;
  onPreview: () => void;
  onShare: () => void;
  onSave?: () => Promise<void> | void;
  onPublish: () => void;
};

export function Topbar({ title, status, onTitleChange, onBack, onPreview, onShare, onSave, onPublish }: Props) {
  return (
    <div className="w-full flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--hp-text-muted)] hover:bg-[var(--hp-surface-2)]"
          onClick={() => onBack && onBack()}
          aria-label="Back"
          title="Back"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="hp-input h-9 px-3 rounded-xl text-lg font-medium bg-transparent border-none focus:bg-[var(--hp-surface-2)]"
        />
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${status === 'dirty' ? 'bg-amber-100 text-amber-700' : status === 'saving' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {status === 'saving' ? 'Saving' : status === 'dirty' ? 'Draft' : 'Saved'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium text-[var(--hp-text-muted)] hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors" onClick={async () => { if (onSave) await onSave(); }}>
          <i className="fa-solid fa-floppy-disk w-4 h-4"></i>
          Save
        </button>
        <button className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium text-[var(--hp-text-muted)] hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors" onClick={onPreview}>
          <i className="fa-solid fa-eye w-4 h-4"></i>
          Preview
        </button>
        <button className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium text-[var(--hp-text-muted)] hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors" onClick={onShare}>
          <i className="fa-solid fa-share w-4 h-4"></i>
          Share
        </button>
        <button className="hp-button-primary inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium transition-colors" onClick={onPublish}>
          <i className="fa-solid fa-check w-4 h-4"></i>
          Publish
        </button>
      </div>
    </div>
  );
}

export default Topbar;


