import React, { useState } from 'react';
import type { RexMessage } from './types';

type Props = {
  messages: RexMessage[];
};

export const MessageList: React.FC<Props> = ({ messages }) => {
  const [openTutorialById, setOpenTutorialById] = useState<Record<string, boolean>>({});
  const normalizeText = (m: RexMessage): string => {
    const raw: any = (m as any).text;
    if (typeof raw === 'string') return raw.replace(/\{\s*"content"[\s\S]*\}\s*$/, '').trim();
    if (raw && typeof raw === 'object') {
      if (typeof raw.text === 'string') return raw.text;
      if (typeof raw.content === 'string') return raw.content;
      try { return JSON.stringify(raw); } catch { return String(raw); }
    }
    return '';
  };
  return (
    <div className="space-y-3 overflow-y-auto px-3 py-4">
      {messages.map((m) => {
        const isOpen = !!openTutorialById[m.id];
        const toggle = () => setOpenTutorialById(prev => ({ ...prev, [m.id]: !prev[m.id] }));
        return (
        <div key={m.id} className="flex flex-col">
          <div className={
            m.role === 'user'
              ? 'ml-auto max-w-[80%] rounded-2xl bg-blue-600 px-4 py-2 text-white'
              : 'mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-4 py-2 text-gray-900'
          }>
            {m.typing ? (
              <span className="inline-flex items-center gap-1 opacity-70">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-500"></span>
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-500 [animation-delay:150ms]"></span>
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-500 [animation-delay:300ms]"></span>
              </span>
            ) : (
              // Render normalized string (handles object shapes like {text: ...})
              normalizeText(m)
            )}
          </div>
          {!!m.sources?.length && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {m.sources.map((s, i) => (
                <a
                  key={`${m.id}_s_${i}`}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-1 text-gray-700 hover:bg-gray-50"
                >
                  {s.title}
                </a>
              ))}
            </div>
          )}
          {!!m.tutorial && m.role === 'assistant' && (
            <div className="mt-2 mr-auto w-full max-w-[80%] rounded-xl border border-gray-200 bg-white p-3">
              <button className="flex w-full items-center justify-between text-left text-sm font-semibold" onClick={toggle}>
                <span>{m.tutorial.title}</span>
                <span className="text-xs text-gray-600">{isOpen ? 'Hide' : 'Show me how'}</span>
              </button>
              {isOpen && (
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-800">
                  {m.tutorial.steps.map((step, idx) => (
                    <li key={`${m.id}_t_${idx}`}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
};

export default MessageList;


