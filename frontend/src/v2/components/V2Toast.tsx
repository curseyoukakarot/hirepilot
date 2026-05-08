/**
 * v2 — V2Toast
 * Tiny toast for "Coming soon" / "Saved" / inline confirmations. Mounted
 * once at the app root via V2ToastProvider; trigger via the `toast()`
 * function exported from this module.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastKind = 'success' | 'info' | 'warn' | 'danger';
interface ToastEntry {
  id: number;
  kind: ToastKind;
  text: string;
  cta?: { label: string; onClick: () => void };
}

interface ToastApi {
  push: (entry: Omit<ToastEntry, 'id'>) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

let externalApi: ToastApi | null = null;
/** Imperative trigger usable from anywhere — e.g. `toast({ text: 'Coming soon' })`. */
export function toast(entry: Omit<ToastEntry, 'id'>) {
  if (externalApi) externalApi.push(entry);
  else console.warn('[v2Toast] no provider mounted; lost:', entry.text);
}
/** Common shorthands. */
export const toastSuccess = (text: string) => toast({ kind: 'success', text });
export const toastInfo    = (text: string) => toast({ kind: 'info', text });
export const toastWarn    = (text: string) => toast({ kind: 'warn', text });
export const toastDanger  = (text: string) => toast({ kind: 'danger', text });
export const toastSoon    = (label: string) => toast({ kind: 'info', text: `${label} — coming soon.` });

export function V2ToastProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ToastEntry[]>([]);
  const counter = useRef(0);

  const push = useCallback((entry: Omit<ToastEntry, 'id'>) => {
    counter.current += 1;
    const id = counter.current;
    setStack((prev) => [...prev, { ...entry, id }]);
    setTimeout(() => setStack((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    externalApi = { push };
    return () => { if (externalApi?.push === push) externalApi = null; };
  }, [push]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {stack.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`min-w-[260px] max-w-[420px] pointer-events-auto rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-[12.5px] shadow-lg float-in ${
              t.kind === 'success' ? 'bg-success text-white' :
              t.kind === 'warn'    ? 'bg-warn text-white' :
              t.kind === 'danger'  ? 'bg-danger text-white' :
              'bg-text-main text-white'
            }`}
            style={{ boxShadow: '0 18px 40px -12px rgba(15,15,26,.45)' }}
          >
            <i className={`fa-solid ${
              t.kind === 'success' ? 'fa-circle-check' :
              t.kind === 'warn'    ? 'fa-triangle-exclamation' :
              t.kind === 'danger'  ? 'fa-circle-exclamation' :
              'fa-circle-info'
            } text-[12px]`} />
            <span className="flex-1">{t.text}</span>
            {t.cta && (
              <button
                onClick={t.cta.onClick}
                className="font-semibold underline text-[11.5px] hover:opacity-80"
              >
                {t.cta.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return { push: (e) => toast(e) };
  }
  return ctx;
}
