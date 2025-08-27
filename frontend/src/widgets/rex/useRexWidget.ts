import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RexConfig, RexMessage, RexMode, RexLeadPayload } from './types';

const OPEN_KEY = 'rex:open';
const ANON_KEY = 'rex:anonId';

function getScope(): string {
  // Use pathname prefix to differentiate public vs app
  const isApp = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  return isApp ? 'app' : 'public';
}

function storageKeyForThread(scope: string, userId: string | null): string {
  const id = userId || getAnonId();
  return `rex:thread:${scope}:${id}`;
}

function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const id = `anon_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(ANON_KEY, id);
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

type UseRexWidgetOptions = {
  initialMode?: RexMode;
  config?: RexConfig;
};

export function useRexWidget(options?: UseRexWidgetOptions) {
  const { initialMode = 'sales', config } = options || {};
  const API_BASE = (import.meta as any).env?.VITE_REX_API_BASE || '';

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(OPEN_KEY) || 'false'); } catch { return false; }
  });
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches; // Tailwind md breakpoint <768
  });
  const [mode, setMode] = useState<RexMode>(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const isApp = path.startsWith('/app');
    // stub for rex flag
    const rexEnabled = false;
    if (rexEnabled) return 'rex';
    return isApp ? 'support' : initialMode || 'sales';
  });
  const scopeRef = useRef<string>(getScope());
  const anonIdRef = useRef<string>(getAnonId());
  const [threadId, setThreadId] = useState<string>('');
  const [messages, setMessages] = useState<RexMessage[]>(() => {
    try {
      const key = storageKeyForThread(scopeRef.current, null);
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as RexMessage[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [salesTurns, setSalesTurns] = useState<number>(0);
  const [salesCtaOverride, setSalesCtaOverride] = useState<boolean>(false);
  const [hasOpened, setHasOpened] = useState<boolean>(false);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(isOpen)); } catch {}
  }, [isOpen]);

  // mobile detection listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', listener);
    else mql.addListener(listener);
    setIsMobile(mql.matches);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', listener);
      else mql.removeListener(listener);
    };
  }, []);

  // persist per scope+id, keep last 15
  useEffect(() => {
    try {
      const key = storageKeyForThread(scopeRef.current, null);
      localStorage.setItem(key, JSON.stringify(messages.slice(-15)));
    } catch {}
  }, [messages]);

  const open = useCallback(() => { setIsOpen(true); setHasOpened(true); }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    setIsOpen(v => {
      const next = !v;
      if (next) setHasOpened(true);
      return next;
    });
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMessage: RexMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      ts: Date.now(),
    };
    const typingMessage: RexMessage = {
      id: `t_${Date.now()}`,
      role: 'assistant',
      text: '',
      ts: Date.now(),
      typing: true,
    };
    setMessages(prev => [...prev, userMessage, typingMessage]);
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/rex_widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rex-anon-id': anonIdRef.current },
        body: JSON.stringify({
          threadId,
          mode,
          messages: [...messages, userMessage].slice(-15).map(m => ({ role: m.role, text: m.text })),
          context: {
            url: typeof window !== 'undefined' ? window.location.href : '',
            pathname: typeof window !== 'undefined' ? window.location.pathname : '',
            rb2b: (typeof window !== 'undefined' ? (window as any).rb2b : null) ?? null,
          },
        }),
      });
      const data = await resp.json().catch(() => null);

      const assistantMessage: RexMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: data?.message?.text || data?.message?.content || 'Thanks! I will get back to you shortly.',
        ts: Date.now(),
        sources: data?.message?.sources || data?.sources || [],
      };
      setThreadId(data?.threadId || data?.thread_id || threadId);
      setMessages(prev => {
        // replace typing placeholder with the real message
        const copy = [...prev];
        const idx = copy.findIndex(m => m.typing);
        if (idx !== -1) copy.splice(idx, 1, assistantMessage);
        else copy.push(assistantMessage);
        return copy.slice(-15);
      });
      if (mode === 'sales') setSalesTurns((t) => t + 1);
    } catch (e) {
      setMessages(prev => prev.filter(m => !m.typing));
      const errorMessage: RexMessage = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        text: 'Sorry, something went wrong. Please try again.',
        ts: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [mode, messages, config, threadId]);

  const showSalesCtas = mode === 'sales' && (salesTurns >= 2 || salesCtaOverride);
  const shouldPulse = !hasOpened;

  const sendHandoff = useCallback(async (reason?: string) => {
    try {
      await fetch(`${API_BASE}/api/rex_widget/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rex-anon-id': anonIdRef.current },
        body: JSON.stringify({ threadId, reason }),
      });
    } catch {}
  }, [threadId, API_BASE]);

  const sendLead = useCallback(async (payload: RexLeadPayload) => {
    const rb2b = (typeof window !== 'undefined' ? (window as any).rb2b : null) ?? null;
    const body = {
      ...payload,
      threadId,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : '',
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        rb2b,
      },
    };
    const resp = await fetch(`${API_BASE}/api/rex_widget/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rex-anon-id': anonIdRef.current },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error('Lead submit failed');
    return resp.json().catch(() => ({}));
  }, [threadId, API_BASE]);

  return {
    isOpen,
    isMobile,
    open,
    close,
    toggle,
    mode,
    setMode,
    messages,
    clear,
    sendMessage,
    loading,
    threadId,
    anonId: anonIdRef.current,
    showSalesCtas,
    sendHandoff,
    sendLead,
    setSalesCtaOverride,
    shouldPulse,
    config: config || {},
  } as const;
}


