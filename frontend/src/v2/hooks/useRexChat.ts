/**
 * useRexChat — talks to /api/rex/chat from the v2 slide-over.
 *
 * Manages:
 *   - Local message thread state (no persistence yet — the existing
 *     /api/rex/conversations endpoint can be wired in a follow-up).
 *   - userId resolution from supabase.auth so the request body is right.
 *   - Sending state (so the composer can disable while in flight).
 *   - One-shot send + response. Streaming version (rexChatStream) is
 *     available for a future upgrade.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { apiPost } from '../../lib/api';

export type RexMsg = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
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

    try {
      // Convert local thread → request shape.
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const resp: any = await apiPost('/api/rex/chat', {
        userId,
        messages: apiMessages,
      });
      // The endpoint returns either a final assistant message string in `reply`
      // or a `messages` payload — handle both shapes.
      const replyText: string | undefined =
        resp?.reply ||
        resp?.assistantMessage ||
        resp?.message?.content ||
        (typeof resp === 'string' ? resp : undefined);

      if (replyText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: replyText, ts: Date.now() }]);
      } else {
        // Fallback: render whatever shape came back.
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '(REX returned a structured response — check the page for results.)', ts: Date.now() },
        ]);
      }
    } catch (e: any) {
      setError(e?.message || 'Send failed');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Couldn't reach REX: ${e?.message || 'unknown error'}`, ts: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, userId]);

  const clear = useCallback(() => {
    setMessages(opts.greeting
      ? [{ role: 'assistant', content: opts.greeting, ts: Date.now() }]
      : []);
    setError(null);
  }, [opts.greeting]);

  return { messages, sending, error, send, clear, userId };
}
