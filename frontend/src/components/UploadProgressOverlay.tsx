import React from 'react';

export function UploadProgressOverlay({
  title = 'Processing…',
  message = 'Hang tight while we process your file.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md text-center shadow-xl">
        <p className="text-lg font-semibold text-white mb-2">{title}</p>
        <p className="text-sm text-slate-300 mb-4">{message}</p>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div className="h-2 w-1/3 bg-indigo-500 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}

