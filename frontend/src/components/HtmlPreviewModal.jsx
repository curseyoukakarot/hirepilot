import React from 'react';

const looksLikeFullHtmlDoc = (s) => {
  if (!s) return false;
  const str = String(s);
  return /<!doctype\s+html/i.test(str) || /<html[\s>]/i.test(str);
};

const buildSrcDoc = (html) => {
  const raw = String(html || '');
  if (looksLikeFullHtmlDoc(raw)) return raw;
  // Wrap fragments so they render consistently inside the iframe.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview</title>
    <style>
      html, body { margin: 0; padding: 0; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
    </style>
  </head>
  <body>
    ${raw}
  </body>
</html>`;
};

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
            <iframe
              title={title || 'HTML Preview'}
              className="w-full rounded bg-white"
              style={{ height: '70vh', border: '0' }}
              // Sandbox to prevent template scripts/styles from impacting the app.
              // Note: most email clients ignore scripts anyway, so this is closer to reality.
              sandbox=""
              srcDoc={buildSrcDoc(html)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HtmlPreviewModal;


