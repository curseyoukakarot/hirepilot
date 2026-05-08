/**
 * useRexChat — talks to /api/rex/chat/stream from the v2 slide-over.
 *
 * Streaming-first: every send opens an SSE-over-POST connection to
 * /api/rex/chat/stream and renders tokens as they arrive. Falls back to
 * the non-streaming /api/rex/chat endpoint when streaming isn't available
 * (e.g. behind a proxy that buffers responses).
 *
 * Manages:
 *   - Local message thread state.
 *   - userId resolution from supabase.auth.
 *   - Sending state (so the composer can disable while in flight).
 *   - Per-message streaming flag so the UI can show a typing indicator
 *     on the in-flight assistant message.
 *   - Tool-call events (event: 'tool_call' from the SSE stream) surfaced
 *     as inline rows in the message thread.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { apiPost } from '../../lib/api';

export type RexToolCall = {
  name: string;
  args: any;
  result?: any;
  status: 'running' | 'done' | 'failed';
};

export type RexMsg = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  /** True while tokens are still streaming in. */
  streaming?: boolean;
  /** Tool calls REX made in service of this message. */
  toolCalls?: RexToolCall[];
};

export interface UseRexChatOpts {
  /** Optional initial assistant message shown in the thread before any send. */
  greeting?: string;
}

export function useRexChat(opts: UseRexChatOpts = {}) {
  const [messages, setMessages] = useState<RexMsg[]>(
    opts.greeting
      ? [{ role: 'assistant', content: opts.greeting, ts: Date.now() }]
      : [],
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data?.user?.id || null);
    });
    return () => { cancelled = true; };
  }, []);

  const abortRef = useRef<AbortController | null>(null);

  /**
   * Stream tokens from /api/rex/chat/stream into the latest assistant
   * message. Returns true on success, false on hard failure (caller can
   * fall back to the non-streaming endpoint).
   */
  const streamChat = useCallback(async (apiMessages: { role: string; content: string }[]): Promise<boolean> => {
    const ac = new AbortController();
    abortRef.current = ac;

    // Resolve API base + auth header the same way lib/api.ts does.
    const { data: session } = await supabase.auth.getSession();
    const accessToken = session?.session?.access_token;
    if (!accessToken) return false;
    const base = (import.meta as any).env?.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname.match(/localhost|127\.0\.0\.1/) ? 'http://localhost:8080' : 'https://api.thehirepilot.com');
    const wsId = (() => { try { return window.localStorage.getItem('hp_active_workspace_id') || ''; } catch { return ''; } })();

    let resp: Response;
    try {
      resp = await fetch(`${base}/api/rex/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${accessToken}`,
          'x-user-id': userId || '',
          ...(wsId ? { 'x-workspace-id': wsId } : {}),
        },
        body: JSON.stringify({ userId, messages: apiMessages }),
        credentials: 'include',
        signal: ac.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') return true;
      console.warn('[useRexChat] stream connect failed:', e?.message);
      return false;
    }

    if (!resp.ok || !resp.body) return false;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Push an empty assistant message we'll fill as tokens arrive.
    setMessages((prev) => [...prev, { role: 'assistant', content: '', ts: Date.now(), streaming: true, toolCalls: [] }]);

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on SSE delimiter (\n\n).
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const block of events) {
          if (!block.trim()) continue;
          const lines = block.split('\n');
          let evt = 'message';
          let dataStr = '';
          for (const ln of lines) {
            if (ln.startsWith('event:')) evt = ln.slice(6).trim();
            else if (ln.startsWith('data:')) dataStr += ln.slice(5).trim();
          }
          let data: any = null;
          try { data = JSON.parse(dataStr); } catch { data = dataStr; }

          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const idx = prev.length - 1;
            const cur = prev[idx];
            if (cur.role !== 'assistant') return prev;
            const nextMsg: RexMsg = { ...cur };
            if (evt === 'token') {
              const t = typeof data === 'string' ? data : data?.t || '';
              nextMsg.content = (nextMsg.content || '') + t;
            } else if (evt === 'tool_call' || evt === 'tool_start') {
              const tc: RexToolCall = { name: data?.name || data?.tool || 'unknown', args: data?.args || data?.arguments || {}, status: 'running' };
              nextMsg.toolCalls = [...(nextMsg.toolCalls || []), tc];
            } else if (evt === 'tool_result' || evt === 'tool_end') {
              const tcs = nextMsg.toolCalls || [];
              const last = tcs[tcs.length - 1];
              if (last && last.status === 'running') {
                last.result = data?.result || data;
                last.status = data?.error ? 'failed' : 'done';
              }
              nextMsg.toolCalls = [...tcs];
            } else if (evt === 'done' || evt === 'end') {
              nextMsg.streaming = false;
            } else if (evt === 'error') {
              nextMsg.streaming = false;
              nextMsg.content = (nextMsg.content || '') + `\n\n⚠️ ${data?.message || 'stream error'}`;
            }
            const out = [...prev];
            out[idx] = nextMsg;
            return out;
          });
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.warn('[useRexChat] stream read failed:', e?.message);
    } finally {
      // Mark streaming complete even if 'done' event was missed.
      setMessages((prev) => {
        if (!prev.length) return prev;
        const idx = prev.length - 1;
        const cur = prev[idx];
        if (cur.role !== 'assistant' || !cur.streaming) return prev;
        const out = [...prev];
        out[idx] = { ...cur, streaming: false };
        return out;
      });
    }
    return true;
  }, [userId]);

  const send = useCallback(async (content: string) => {
    const text = content.trim();
    if (!text || sending) return;
    if (!userId) {
      setError('Not signed in');
      return;
    }
    setError(null);
    setSending(true);

    // Push the user msg immediately so the UI renders.
    const next: RexMsg[] = [...messages, { role: 'user', content: text, ts: Date.now() }];
    setMessages(next);
    const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));

    // Try streaming first.
    let streamOk = false;
    try {
      streamOk = await streamChat(apiMessages);
    } catch {
      streamOk = false;
    }

    if (!streamOk) {
      // Fallback: non-streaming endpoint.
      try {
        const resp: any = await apiPost('/api/rex/chat', { userId, messages: apiMessages });
        const replyText: string | undefined =
          resp?.reply || resp?.assistantMessage || resp?.message?.content ||
          (typeof resp === 'string' ? resp : undefined);
        if (replyText) {
          setMessages((prev) => [...prev, { role: 'assistant', content: replyText, ts: Date.now() }]);
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: '(REX returned a structured response — check the page for results.)', ts: Date.now() }]);
        }
      } catch (e: any) {
        setError(e?.message || 'Send failed');
        setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ Couldn't reach REX: ${e?.message || 'unknown error'}`, ts: Date.now() }]);
      }
    }

    setSending(false);
  }, [messages, sending, userId, streamChat]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const clear = useCallback(() => {
    setMessages(opts.greeting
      ? [{ role: 'assistant', content: opts.greeting, ts: Date.now() }]
      : []);
    setError(null);
  }, [opts.greeting]);

  return { messages, sending, error, send, clear, stop, userId };
}
