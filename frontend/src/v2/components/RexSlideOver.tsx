/**
 * v2 / REX Slide-Over — opens when user clicks the floating REX FAB.
 *
 * HTML preserved from mockups/rex-open.html (panel section). Conversation
 * thread + composer are now wired to /api/rex/chat via useRexChat — REX
 * actually answers. The "Plan" detail block (delegation chips, live skill
 * embed) stays as visual reference until streaming + tool-call rendering
 * are wired in a follow-up.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRexChat } from '../hooks/useRexChat';

interface Props {
  open: boolean;
  onClose: () => void;
  contextLabel?: string;        // "you're on the Today page · 1 decision waiting"
  workspaceName?: string;
}

export default function RexSlideOver({ open, onClose, contextLabel = "you're on the Today page · 1 decision waiting", workspaceName }: Props) {
  const { messages, sending, send } = useRexChat({
    greeting: "Hey — I'm REX. Ask me anything, or type / for a command.",
  });
  const [draft, setDraft] = useState('');
  const composerRef = useRef<HTMLInputElement | null>(null);

  // Focus composer when panel opens.
  useEffect(() => {
    if (open) setTimeout(() => composerRef.current?.focus(), 80);
  }, [open]);

  const submit = () => {
    if (!draft.trim() || sending) return;
    send(draft);
    setDraft('');
  };

  if (!open) return null;

  return (
    <>
      {/* Dim overlay */}
      <div
        className="fixed inset-0 z-[48] cursor-pointer"
        style={{ background: 'rgba(15,15,26,.18)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-label="Close REX"
      />

      {/* Slide-over panel */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-[49] flex flex-col slide-in-right"
        style={{ width: '440px', background: 'white', boxShadow: '-20px 0 60px -20px rgba(15,15,26,.25)' }}
      >
        {/* Header */}
        <div className="px-[18px] py-3.5 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full grad-rex flex items-center justify-center text-white relative shrink-0" style={{ fontSize: '13px' }}>
            <i className="fa-solid fa-wand-magic-sparkles text-[12px]" />
            <span className="absolute" style={{ inset: '-6px', borderRadius: '9999px', background: 'radial-gradient(circle, rgba(107,70,193,.4), transparent 70%)', filter: 'blur(8px)', zIndex: -1 }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14px] flex items-center gap-2">
              REX <span className="tag tag-primary"><span className="live-dot" />Awake</span>
            </div>
            <div className="text-[10.5px] text-text-muted">Coordinating Sourcer · Recruiter · Coordinator</div>
          </div>
          <div className="inline-flex items-center bg-surface rounded-full p-0.5 gap-px text-[10px]" style={{ border: '1px solid #E5E7EB' }}>
            <span className="px-2 py-0.5 rounded-full bg-white text-text-main font-semibold" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>Chat</span>
            <span className="px-2 py-0.5 rounded-full text-text-muted font-semibold cursor-pointer">Voice</span>
            <span className="px-2 py-0.5 rounded-full text-text-muted font-semibold cursor-pointer">Plan</span>
          </div>
          <button className="w-7 h-7 rounded-md hover:bg-surface flex items-center justify-center text-text-muted ml-1"><i className="fa-solid fa-expand text-[11px]" /></button>
          <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-surface flex items-center justify-center text-text-muted"><i className="fa-solid fa-xmark text-[12px]" /></button>
        </div>

        {/* Context awareness banner */}
        <div className="mx-3.5 mt-3 px-3 py-2 rounded-md flex items-center gap-1.5 text-[11px]" style={{ background: 'linear-gradient(90deg,rgba(107,70,193,.06),rgba(12,92,244,.03) 60%,transparent)', border: '1px solid rgba(107,70,193,.12)' }}>
          <i className="fa-solid fa-eye text-primary text-[10px]" />
          <span className="text-text-secondary"><span className="font-semibold text-text-main">Context:</span> {contextLabel}</span>
          <span className="ml-auto text-[10px] text-text-muted">⌘K</span>
        </div>

        {/* Conversation thread */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Live messages (newest at bottom) — wired to /api/rex/chat/stream */}
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={`live-${i}`} className="flex justify-end float-in">
                <div className="grad-icon text-white rounded-[12px] rounded-tr-[4px] px-3.5 py-2.5 max-w-[80%] text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ boxShadow: '0 4px 12px -4px rgba(107,70,193,.3)' }}>
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={`live-${i}`} className="flex gap-2.5 float-in">
                <div className="w-6 h-6 rounded-full grad-rex flex items-center justify-center text-white text-[10px] mt-1 shrink-0">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Tool calls REX made for this message */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {m.toolCalls.map((tc, ti) => (
                        <div key={ti} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] mr-1.5"
                          style={{
                            background: tc.status === 'failed' ? 'rgba(239,68,68,.08)' :
                              tc.status === 'done' ? 'rgba(16,185,129,.08)' : 'rgba(107,70,193,.08)',
                            color: tc.status === 'failed' ? '#B91C1C' : tc.status === 'done' ? '#047857' : '#6B46C1',
                          }}
                        >
                          <i className={`fa-solid ${tc.status === 'failed' ? 'fa-circle-exclamation' :
                            tc.status === 'done' ? 'fa-circle-check' : 'fa-spinner fa-spin'} text-[9px]`} />
                          <span className="font-mono text-[10px]">{tc.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[13.5px] text-text-main leading-relaxed whitespace-pre-wrap">
                    {m.content}
                    {m.streaming && <span className="inline-block w-2 h-4 align-middle bg-primary/60 ml-0.5 animate-pulse" />}
                  </div>
                  {!m.streaming && (
                    <div className="text-[10px] text-text-muted mt-1.5 ml-1">{relativeTime(m.ts)}</div>
                  )}
                </div>
              </div>
            )
          ))}
          {sending && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-2.5 float-in">
              <div className="w-6 h-6 rounded-full grad-rex flex items-center justify-center text-white text-[10px] mt-1 shrink-0">
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <div className="flex-1 text-[12.5px] text-text-muted">
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> REX is thinking…
              </div>
            </div>
          )}


        </div>

        {/* Composer */}
        <div className="px-3.5 py-3 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-1 mb-2 px-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Try</span>
            {['/source ', '/research ', '/draft ', '/schedule '].map((s) => (
              <button
                key={s}
                onClick={() => { setDraft(s); setTimeout(() => composerRef.current?.focus(), 0); }}
                className="inline-flex items-center px-1.5 py-px rounded-md text-[10.5px] font-mono cursor-pointer"
                style={{ color: '#6B46C1', background: 'rgba(107,70,193,.08)' }}
              >
                {s.trim()}
              </button>
            ))}
            <button
              onClick={() => send('What can you help me with right now?')}
              className="ml-auto inline-flex items-center px-1.5 py-px rounded-md text-[10.5px] font-mono cursor-pointer"
              style={{ color: '#6B46C1', background: 'rgba(107,70,193,.08)' }}
            >
              /help
            </button>
          </div>

          <div className="rounded-[14px] p-2.5 px-3.5 flex flex-col gap-2 transition" style={{ background: '#F4F4F8', border: '1px solid #E5E7EB' }}>
            <input
              ref={composerRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              disabled={sending}
              className="bg-transparent outline-none text-[13.5px] placeholder:text-text-muted w-full disabled:opacity-60"
              placeholder={sending ? 'REX is thinking…' : 'Ask REX or use /commands…'}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-text-muted">
                <button className="w-6 h-6 rounded hover:bg-white flex items-center justify-center"><i className="fa-solid fa-paperclip text-[11px]" /></button>
                <button className="w-6 h-6 rounded hover:bg-white flex items-center justify-center"><i className="fa-solid fa-microphone text-[11px]" /></button>
                <button className="w-6 h-6 rounded hover:bg-white flex items-center justify-center"><i className="fa-solid fa-image text-[11px]" /></button>
                <span className="text-[10px] text-text-muted ml-1.5">⏎ send · ⇧⏎ newline</span>
              </div>
              <button onClick={submit} disabled={!draft.trim() || sending} className="btn-solid !py-1 !px-3 !text-[11.5px] disabled:opacity-50">
                <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-arrow-up'} text-[10px]`} />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-text-muted">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="live-dot" />Connected: Slack · Gmail · Calendar</span>
            </div>
            <span className="flex items-center gap-1"><i className="fa-solid fa-shield-halved text-[9px]" />Autopilot guardrails on</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function relativeTime(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 5000) return 'just now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
