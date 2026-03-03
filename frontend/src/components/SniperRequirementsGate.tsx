import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';

type Props = {
  children: React.ReactNode;
};

type RequirementsState = {
  loading: boolean;
  agentModeEnabled: boolean | null;
  error?: string | null;
};

function BlockerModal({
  title,
  description,
  primaryLabel,
  onPrimary,
  tertiaryLabel,
  onTertiary,
  loading,
}: {
  title: string;
  description: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cloud Engine</div>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        </div>

        <div className="px-5 py-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">{description}</div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onPrimary}
              disabled={!!loading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-70"
            >
              {loading ? 'Checking…' : primaryLabel}
            </button>
            {tertiaryLabel && onTertiary ? (
              <button
                type="button"
                onClick={onTertiary}
                className="inline-flex w-full items-center justify-center rounded-xl border border-transparent bg-transparent px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                {tertiaryLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SniperRequirementsGate({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<RequirementsState>({
    loading: true,
    agentModeEnabled: null,
    error: null,
  });

  const check = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const agent = await apiGet('/api/agent-mode');
      const agentOn = !!(agent as any)?.agent_mode_enabled;
      setState({ loading: false, agentModeEnabled: agentOn, error: null });
    } catch (e: any) {
      setState({
        loading: false,
        agentModeEnabled: false,
        error: String(e?.message || 'Unable to verify Agent Mode status'),
      });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check, location.pathname]);

  useEffect(() => {
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  // Only block if Agent Mode is not enabled
  const shouldBlock = state.loading || state.agentModeEnabled === false;

  useEffect(() => {
    if (!shouldBlock) return;
    const prevOverflow = document?.body?.style?.overflow;
    try {
      document.body.style.overflow = 'hidden';
    } catch {}
    return () => {
      try {
        document.body.style.overflow = prevOverflow || '';
      } catch {}
    };
  }, [shouldBlock]);

  const modal = useMemo(() => {
    if (!shouldBlock) return null;

    if (state.loading) {
      return (
        <BlockerModal
          title="Checking requirements…"
          description="Verifying Agent Mode status."
          primaryLabel="Refresh"
          onPrimary={check}
          loading={false}
        />
      );
    }

    return (
      <BlockerModal
        title="Enable Agent Mode"
        description={
          <div className="space-y-2">
            <p>
              Cloud Engine requires <span className="font-semibold">Agent Mode</span> to be enabled.
            </p>
            <p>
              Turn it on in <span className="font-semibold">Settings &rarr; Integrations</span>, then come back here.
            </p>
            {state.error && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Note: {state.error}</p>
            )}
          </div>
        }
        primaryLabel="Go to Settings → Integrations"
        onPrimary={() => navigate('/settings/integrations')}
        tertiaryLabel="Refresh"
        onTertiary={check}
      />
    );
  }, [check, navigate, shouldBlock, state.error, state.loading]);

  return (
    <>
      {children}
      {modal}
    </>
  );
}

