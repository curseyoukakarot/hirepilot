import React from 'react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { QuickSuggestions } from './QuickSuggestions';
import ArticleCard from './ArticleCard';
import type { RexMessage, RexMode } from './types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  loading?: boolean;
  messages: RexMessage[];
  mode: RexMode;
  demoUrl?: string;
  calendlyUrl?: string;
  showSalesCtas?: boolean;
  onHandoff?: () => void;
  onOpenLead?: () => void;
  onContactSupport?: () => void;
};

export const ChatPanel: React.FC<Props> = ({ isOpen, onClose, onSend, loading, messages, mode, demoUrl, calendlyUrl, showSalesCtas, onHandoff, onOpenLead, onContactSupport }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed bottom-24 right-6 z-50 w-[380px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in data-[state=open]:slide-in-from-bottom-4">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">{mode === 'sales' ? 'Sales Assistant' : mode === 'support' ? 'Support Assistant' : 'REX Assistant'}</div>
        <div className="flex items-center gap-2">
          {mode === 'sales' && (
            <button onClick={onOpenLead} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Lead</button>
          )}
          {mode === 'support' && (
            <button onClick={onContactSupport} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">Contact Support</button>
          )}
          <button onClick={onClose} aria-label="Close chat" className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
          </button>
        </div>
      </div>
      <div className="h-80 overflow-y-auto">
        <MessageList messages={messages} />
      </div>
      {mode === 'support' && (() => {
        const lastWithArticles = [...messages].reverse().find(m => m.articles && m.articles.length);
        const recs = lastWithArticles?.articles?.slice(0, 2) || [];
        return recs.length ? (
          <div className="flex gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
            {recs.map((a, idx) => (
              <ArticleCard key={`rec_${idx}`} title={a.title} excerpt={a.excerpt} url={a.url} />
            ))}
          </div>
        ) : null;
      })()}
      {showSalesCtas && (
        <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          {demoUrl && (
            <a href={demoUrl} target="_blank" rel="noreferrer" className="rounded-full border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100">Watch 90-sec demo</a>
          )}
          {calendlyUrl && (
            <a href={calendlyUrl} target="_blank" rel="noreferrer" className="rounded-full border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100">Book live walkthrough</a>
          )}
          <button onClick={onHandoff} className="rounded-full border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100">Talk to a human</button>
        </div>
      )}
      <MessageComposer
        isSending={loading}
        onSend={onSend}
        quickActions={
          <QuickSuggestions onPick={onSend} />
        }
      />
    </div>
  );
};

export default ChatPanel;


