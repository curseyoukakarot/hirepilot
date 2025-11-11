import React from 'react';

type Props = {
  title: string;
  status: 'saved' | 'saving' | 'dirty';
  onTitleChange: (t: string) => void;
  onPreview: () => void;
  onShare: () => void;
  onPublish: () => void;
};

export function Topbar({ title, status, onTitleChange, onPreview, onShare, onPublish }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <input
          className="text-lg font-semibold bg-transparent outline-none"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {status === 'saving' ? 'Saving…' : status === 'dirty' ? 'Unsaved' : 'Saved'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-2 py-1 border rounded" onClick={onPreview}>Preview</button>
        <button className="px-2 py-1 border rounded" onClick={onShare}>Share</button>
        <button className="px-2 py-1 bg-primary text-primary-foreground rounded" onClick={onPublish}>Publish</button>
      </div>
    </div>
  );
}

export default Topbar;


