import React from 'react';

function HtmlPreviewModal({ isOpen, title, subject, html, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <div className="text-sm text-gray-500">Preview</div>
            <div className="text-lg font-semibold truncate">{title || 'HTML Preview'}</div>
            {subject ? (
              <div className="text-sm text-gray-700 mt-1 truncate">
                <span className="text-gray-500">Subject:</span> {subject}
              </div>
            ) : null}
          </div>
          <button
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-gray-700"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-72px)]">
          <div className="border rounded-lg bg-gray-50 p-4">
            <div
              className="prose max-w-none"
              // Preview-only: caller controls HTML. This is for email rendering preview.
              dangerouslySetInnerHTML={{ __html: html || '' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HtmlPreviewModal;


