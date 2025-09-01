import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RexConfig, RexMessage, RexMode, RexLeadPayload, RexCta } from './types';
import { supabase } from '../../lib/supabase';

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
  // Determine backend base URL (no trailing /api). Works on marketing site and local dev.
  const API_BASE = ((): string => {
    const envBase = (import.meta as any).env?.VITE_REX_API_BASE;
    // @ts-ignore
    const flagsBase = (typeof window !== 'undefined' && (window as any).__REX_FLAGS__?.apiBaseUrl) || undefined;
    // @ts-ignore
    const windowBase = (typeof window !== 'undefined' && (window as any).VITE_BACKEND_URL) || undefined;
    if (envBase) return String(envBase);
    if (flagsBase) return String(flagsBase);
    if (windowBase) return String(windowBase);
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (/thehirepilot\.com$/i.test(window.location.hostname)) return 'https://api.thehirepilot.com';
      // Fallback to local backend
      return 'http://localhost:8080';
    }
    return '';
  })();

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
  const [cta, setCta] = useState<RexCta | null>(null);
  const [salesTurns, setSalesTurns] = useState<number>(0);
  const [salesCtaOverride, setSalesCtaOverride] = useState<boolean>(false);
  const [hasOpened, setHasOpened] = useState<boolean>(false);
  const [isLive, setIsLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'online' | 'connected'>('idle');

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

  // Listen for human replies via Supabase Realtime
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`rex_widget:${threadId}`)
      .on('broadcast', { event: 'human_reply' }, (payload: any) => {
        try {
          const p = payload?.payload || payload;
          const text: string = p?.message || p?.text || '';
          const name: string | undefined = p?.name || undefined;
          if (!text) return;
          setMessages(prev => prev.concat([{
            id: `hr_${Date.now()}`,
            role: 'assistant',
            text: name ? `${name}: ${text}` : text,
            ts: Date.now(),
          }]));
          setIsLive(true);
          setLiveStatus('connected');
        } catch {}
      })
      .subscribe();
    return () => { try { channel.unsubscribe(); } catch {} };
  }, [threadId]);

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
      if (data?.state === 'live') {
        setIsLive(true);
        setLiveStatus('connected');
      }

      const assistantMessage: RexMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: data?.message?.text || data?.message?.content || 'Thanks! I will get back to you shortly.',
        ts: Date.now(),
        sources: data?.message?.sources || data?.sources || [],
      };
      setThreadId(data?.threadId || data?.thread_id || threadId);
      setCta(data?.cta || null);
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

  const sendHandoff = useCallback(async (reason?: string | any) => {
    try {
      // Normalize reason (avoid passing SyntheticEvent which is circular)
      const safeReason: string | undefined = typeof reason === 'string' ? reason : undefined;
      // Debug: verify base URL resolution
      try { console.debug('[REX] sendHandoff', { API_BASE, threadId, reason: safeReason }); } catch {}
      setIsLive(true);
      setLiveStatus('connecting');

      // Ensure a session exists. If no thread yet, create one without sending a user message
      let ensuredThreadId = threadId;
      if (!ensuredThreadId) {
        try {
          const resp = await fetch(`${API_BASE}/api/rex_widget/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-rex-anon-id': anonIdRef.current },
            body: JSON.stringify({
              mode,
              messages: [],
              context: {
                url: typeof window !== 'undefined' ? window.location.href : '',
                pathname: typeof window !== 'undefined' ? window.location.pathname : '',
                rb2b: (typeof window !== 'undefined' ? (window as any).rb2b : null) ?? null,
              },
            }),
          });
          const data = await resp.json().catch(() => null);
          if (data?.threadId) { ensuredThreadId = data.threadId; setThreadId(data.threadId); }
        } catch {}
      }

      const resp = await fetch(`${API_BASE}/api/rex_widget/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rex-anon-id': anonIdRef.current },
        body: JSON.stringify({ threadId: ensuredThreadId, reason: safeReason }),
      });
      try {
        const clone = resp.clone();
        const body = await clone.json().catch(() => ({}));
        console.log('[REX] handoff response', { status: resp.status, body });
        if (!resp.ok) {
          try { (await import('react-hot-toast')).toast.error('Error connecting to support — please try again.'); } catch {}
        }
      } catch {}

      // Immediate UX feedback so users know we notified the team
      setMessages(prev => prev.concat([{
        id: `h_${Date.now()}`,
        role: 'assistant',
        text: 'Got it — I notified our team. If someone is available now, they will reply here in this chat shortly. Otherwise we will follow up by email.',
        ts: Date.now(),
      }]));
      setLiveStatus('online');
    } catch (e) {
      try { console.error('[REX] handoff failed', e); } catch {}
      try { (await import('react-hot-toast')).toast.error('Failed to notify team — please try again or email support@thehirepilot.com'); } catch {}
      setMessages(prev => prev.concat([{
        id: `h_${Date.now()}`,
        role: 'assistant',
        text: 'Error notifying the team — please try again or contact support@thehirepilot.com directly.',
        ts: Date.now(),
      }]));
      setLiveStatus('idle');
    }
  }, [threadId, API_BASE, mode]);

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
    cta,
    isLive,
    liveStatus,
  } as const;
}


