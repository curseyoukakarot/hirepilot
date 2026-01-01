import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

function resolveApiBase() {
  let base = (import.meta as any)?.env?.VITE_BACKEND_URL || '';
  base = String(base || '').trim();
  if (!base) {
    try {
      const host = window.location.host;
      if (host.endsWith('thehirepilot.com')) base = 'https://api.thehirepilot.com';
      else base = 'http://localhost:8080';
    } catch {
      base = '';
    }
  }
  return String(base).replace(/\/$/, '');
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // Avoid leaking any cookies cross-origin from a custom domain
    credentials: 'omit',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `${res.status} ${res.statusText}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

type Props = {
  hostOverride?: string;
  slugOverride?: string;
  whiteLabel?: boolean;
};

export default function PublicLandingPage(props: Props) {
  const params = useParams();
  const apiBase = useMemo(() => resolveApiBase(), []);
  const slugFromRoute = String((params as any)?.slug || '').trim();
  const [slug, setSlug] = useState<string>(props.slugOverride || slugFromRoute || '');
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'not_found' | 'error'>('idle');

  const host = useMemo(() => {
    if (props.hostOverride) return props.hostOverride;
    try {
      return window.location.hostname || '';
    } catch {
      return '';
    }
  }, [props.hostOverride]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setStatus('idle');

        let resolvedSlug = props.slugOverride || slugFromRoute || slug;
        if (!resolvedSlug && host) {
          const r = await fetchJson(`${apiBase}/api/landing-domains/resolve?host=${encodeURIComponent(host)}`);
          resolvedSlug = String(r?.slug || '').trim();
        }
        if (!resolvedSlug) {
          if (!cancelled) {
            setStatus('not_found');
            setHtml('');
          }
          return;
        }

        if (!cancelled) setSlug(resolvedSlug);
        const page = await fetchJson(`${apiBase}/api/landing-pages/by-slug/${encodeURIComponent(resolvedSlug)}`);
        const pageHtml = String(page?.landingPage?.html || '');
        if (!cancelled) {
          setHtml(pageHtml);
          setStatus(pageHtml ? 'idle' : 'not_found');
        }
      } catch (e: any) {
        if (!cancelled) {
          setStatus(e?.status === 404 ? 'not_found' : 'error');
          setHtml('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, host, props.slugOverride, slugFromRoute]);

  const srcDoc = useMemo(() => {
    const base = html || '';
    if (!base) return '';
    if (!props.whiteLabel) return base;

    // White-label mode: hide obvious HirePilot branding if the default template is used.
    // We keep this best-effort and non-destructive.
    const injection = `
<style>
  .hp-badge { display: none !important; }
</style>
<script>
  (function(){
    try {
      var nodes = document.querySelectorAll('*');
      for (var i=0;i<nodes.length;i++){
        var el = nodes[i];
        if (!el || !el.textContent) continue;
        if (el.textContent.includes('Powered by HirePilot')) {
          el.style.display = 'none';
        }
      }
    } catch(e){}
  })();
</script>`;

    // If the HTML already has a closing </body>, inject before it; otherwise append.
    if (base.includes('</body>')) return base.replace('</body>', `${injection}</body>`);
    return `${base}\n${injection}`;
  }, [html, props.whiteLabel]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#020617] text-slate-200">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-5 w-5 rounded-full border-2 border-slate-600 border-t-sky-400 animate-spin" />
          <span className="text-sm">Loading landing page…</span>
        </div>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#020617] text-slate-200 p-8">
        <div className="max-w-xl w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 text-center">
          <div className="text-sm font-semibold text-slate-100 mb-1">Landing page not found</div>
          <div className="text-xs text-slate-400">
            {slug ? `We couldn’t find a published landing page for “${slug}”.` : 'This domain is not connected yet.'}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#020617] text-slate-200 p-8">
        <div className="max-w-xl w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 text-center">
          <div className="text-sm font-semibold text-slate-100 mb-1">Something went wrong</div>
          <div className="text-xs text-slate-400">Please refresh and try again.</div>
        </div>
      </div>
    );
  }

  // Render user HTML inside an iframe for isolation/safety.
  return (
    <div className="bg-[#020617] min-h-screen">
      <iframe
        title={`Landing • ${slug || 'profile'}`}
        srcDoc={srcDoc}
        className="w-full min-h-screen border-0"
        sandbox="allow-same-origin allow-popups allow-forms allow-scripts"
      />
    </div>
  );
}


