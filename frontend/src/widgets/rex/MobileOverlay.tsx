import React from 'react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import type { RexMessage, RexMode, RexCta } from './types';
import ArticleCard from './ArticleCard';

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
  onContactSupport?: () => void;
  cta?: RexCta | null;
};

export const MobileOverlay: React.FC<Props> = ({ isOpen, onClose, onSend, loading, messages, mode, demoUrl, calendlyUrl, showSalesCtas, onHandoff, onContactSupport, cta }) => {
  return (
    <div className={
      'fixed inset-0 z-50 bg-white sm:hidden transition-transform duration-300 ' +
      (isOpen ? 'translate-y-0' : 'translate-y-full')
    }>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">{mode === 'sales' ? 'Sales Assistant' : mode === 'support' ? 'Support Assistant' : 'REX Assistant'}</div>
        <button onClick={onContactSupport} className="mr-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">Support</button>
        <button onClick={onClose} aria-label="Close chat" className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
        </button>
      </div>
      <div className="flex h-[calc(100%-56px-88px)] flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <MessageList messages={messages} />
        </div>
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
      {!!cta && cta.type !== 'none' && (
        <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          {cta.type === 'link' && cta.url && (
            <a href={cta.url} target="_blank" rel="noreferrer" className="rounded-full border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100">{cta.label || 'Open'}</a>
          )}
          {cta.type === 'calendly' && (calendlyUrl || cta.url) && (
            <a href={(cta.url || calendlyUrl)!} target="_blank" rel="noreferrer" className="rounded-full border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100">{cta.label || 'Book on Calendly'}</a>
          )}
          {cta.type === 'lead_form' && (
            <button onClick={onContactSupport} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100">{cta.label || 'Share your details'}</button>
          )}
          {cta.type === 'support_ticket' && (
            <button onClick={onContactSupport} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700 hover:bg-gray-100">{cta.label || 'Create ticket'}</button>
          )}
        </div>
      )}
      <MessageComposer isSending={loading} onSend={onSend} />
    </div>
  );
};

export default MobileOverlay;


