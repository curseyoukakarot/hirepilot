import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  title: string;
  status: 'saved' | 'saving' | 'dirty';
  onTitleSave?: (t: string) => Promise<void> | void;
  onBack?: () => void;
  onPreview: () => void;
  onShare: () => void;
  onSave?: () => Promise<void> | void;
  onPublish: () => void;
};

export function Topbar({ title, status, onTitleSave, onBack, onPreview, onShare, onSave, onPublish }: Props) {
  const [draftTitle, setDraftTitle] = useState(title || '');
  const [localDirty, setLocalDirty] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const lastSavedRef = useRef<string>(title || '');
  const debounceRef = useRef<number | null>(null);
  const focusedRef = useRef(false);

  // Sync external title into local draft when not actively editing or dirty.
  useEffect(() => {
    if (focusedRef.current) return;
    if (localDirty) return;
    setDraftTitle(title || '');
    lastSavedRef.current = title || '';
  }, [title, localDirty]);

  const displayStatus: Props['status'] = useMemo(() => {
    if (localSaving || status === 'saving') return 'saving';
    if (localDirty || status === 'dirty') return 'dirty';
    return 'saved';
  }, [localSaving, localDirty, status]);

  const flushSave = async () => {
    if (!onTitleSave) return;
    const next = (draftTitle || '').trim();
    // Avoid spamming: only save if changed
    if (!next || next === lastSavedRef.current) {
      setLocalDirty(false);
      return;
    }
    setLocalSaving(true);
    try {
      await onTitleSave(next);
      lastSavedRef.current = next;
      setLocalDirty(false);
    } finally {
      setLocalSaving(false);
    }
  };

  const scheduleSave = () => {
    if (!onTitleSave) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      flushSave().catch(() => {});
    }, 650);
  };

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
          value={draftTitle}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={() => {
            focusedRef.current = false;
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
            flushSave().catch(() => {});
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraftTitle(next);
            setLocalDirty(true);
            scheduleSave();
          }}
          className="hp-input h-9 px-3 rounded-xl text-lg font-medium bg-transparent border-none focus:bg-[var(--hp-surface-2)]"
        />
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${displayStatus === 'dirty' ? 'bg-amber-100 text-amber-700' : displayStatus === 'saving' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {displayStatus === 'saving' ? 'Saving' : displayStatus === 'dirty' ? 'Draft' : 'Saved'}
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


