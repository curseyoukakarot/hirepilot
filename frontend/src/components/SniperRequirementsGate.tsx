import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';

type Props = {
  children: React.ReactNode;
};

type RequirementsState = {
  loading: boolean;
  agentModeEnabled: boolean | null;
  cloudEngineEnabled: boolean | null;
  error?: string | null;
};

function BlockerModal({
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary,
  canClose,
  onClose,
  loading,
}: {
  title: string;
  description: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  canClose?: boolean;
  onClose?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Sniper is gated</div>
            <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          </div>
          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              Close
            </button>
          ) : null}
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
            {secondaryLabel && onSecondary ? (
              <button
                type="button"
                onClick={onSecondary}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
              >
                {secondaryLabel}
              </button>
            ) : null}
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
    cloudEngineEnabled: null,
    error: null,
  });
  const [dismissedOnThisRoute, setDismissedOnThisRoute] = useState(false);

  const check = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [agent, sniper] = await Promise.all([
        apiGet('/api/agent-mode'),
        apiGet('/api/sniper/settings'),
      ]);
      const agentOn = !!(agent as any)?.agent_mode_enabled;
      const cloudOn = !!(sniper as any)?.cloud_engine_enabled;
      setState({ loading: false, agentModeEnabled: agentOn, cloudEngineEnabled: cloudOn, error: null });
    } catch (e: any) {
      // If we can't verify prerequisites, default to blocking (safe).
      setState({
        loading: false,
        agentModeEnabled: false,
        cloudEngineEnabled: false,
        error: String(e?.message || 'Unable to verify Sniper prerequisites'),
      });
    }
  }, []);

  useEffect(() => {
    void check();
    setDismissedOnThisRoute(false);
  }, [check, location.pathname]);

  useEffect(() => {
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  // Prevent background scroll while blocked (except when dismissed on settings route)
  const shouldBlock =
    !dismissedOnThisRoute &&
    (state.loading ||
      state.agentModeEnabled === false ||
      state.cloudEngineEnabled === false);

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

  const isSniperSettingsRoute = useMemo(() => (location.pathname || '') === '/sniper/settings', [location.pathname]);

  const missingAgentMode = state.agentModeEnabled === false;
  const missingCloudEngine = state.cloudEngineEnabled === false;

  const modal = useMemo(() => {
    if (!shouldBlock) return null;

    // While loading, show a neutral modal
    if (state.loading) {
      return (
        <BlockerModal
          title="Checking requirements…"
          description="Verifying Agent Mode and Cloud Engine status."
          primaryLabel="Refresh"
          onPrimary={check}
          secondaryLabel={isSniperSettingsRoute ? 'Continue to Sniper Settings' : undefined}
          onSecondary={isSniperSettingsRoute ? () => setDismissedOnThisRoute(true) : undefined}
          canClose={isSniperSettingsRoute}
          onClose={isSniperSettingsRoute ? () => setDismissedOnThisRoute(true) : undefined}
          loading={false}
        />
      );
    }

    // If both are missing, present both CTAs
    if (missingAgentMode && missingCloudEngine) {
      return (
        <BlockerModal
          title="Enable Agent Mode + Cloud Engine"
          description={
            <div className="space-y-2">
              <p>
                Sniper requires <span className="font-semibold">Agent Mode</span> and <span className="font-semibold">Cloud Engine</span>.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {state.error ? `Note: ${state.error}` : 'Once enabled, come back here and click Refresh.'}
              </p>
            </div>
          }
          primaryLabel="Turn on Agent Mode in Settings"
          onPrimary={() => navigate('/settings/integrations')}
          secondaryLabel="Enable Cloud Engine in Sniper Settings"
          onSecondary={() => navigate('/sniper/settings')}
          tertiaryLabel="Refresh"
          onTertiary={check}
          canClose={isSniperSettingsRoute}
          onClose={isSniperSettingsRoute ? () => setDismissedOnThisRoute(true) : undefined}
        />
      );
    }

    if (missingAgentMode) {
      return (
        <BlockerModal
          title="Turn on Agent Mode"
          description={
            <div className="space-y-2">
              <p>
                To use Sniper, enable <span className="font-semibold">Agent Mode</span> in Settings.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {state.error ? `Note: ${state.error}` : 'After enabling, come back here and click Refresh.'}
              </p>
            </div>
          }
          primaryLabel="Go to Settings → Integrations"
          onPrimary={() => navigate('/settings/integrations')}
          secondaryLabel={isSniperSettingsRoute ? 'Continue to Sniper Settings' : undefined}
          onSecondary={isSniperSettingsRoute ? () => setDismissedOnThisRoute(true) : undefined}
          tertiaryLabel="Refresh"
          onTertiary={check}
          canClose={isSniperSettingsRoute}
          onClose={isSniperSettingsRoute ? () => setDismissedOnThisRoute(true) : undefined}
        />
      );
    }

    if (missingCloudEngine) {
      return (
        <BlockerModal
          title="Enable Cloud Engine"
          description={
            <div className="space-y-2">
              <p>
                To run Sniper missions, enable <span className="font-semibold">Cloud Engine</span> in Sniper Settings.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {state.error ? `Note: ${state.error}` : 'After enabling, come back here and click Refresh.'}
              </p>
            </div>
          }
          primaryLabel="Go to Sniper Settings"
          onPrimary={() => navigate('/sniper/settings')}
          secondaryLabel={isSniperSettingsRoute ? 'Continue to Sniper Settings' : undefined}
          onSecondary={isSniperSettingsRoute ? () => setDismissedOnThisRoute(true) : undefined}
          tertiaryLabel="Refresh"
          onTertiary={check}
          canClose={isSniperSettingsRoute}
          onClose={isSniperSettingsRoute ? () => setDismissedOnThisRoute(true) : undefined}
        />
      );
    }

    return null;
  }, [
    check,
    isSniperSettingsRoute,
    missingAgentMode,
    missingCloudEngine,
    navigate,
    shouldBlock,
    state.error,
    state.loading,
  ]);

  return (
    <>
      {children}
      {modal}
    </>
  );
}

