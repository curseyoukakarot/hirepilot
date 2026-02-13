export type AppMode = 'recruiter' | 'job_seeker' | 'ignite';

export function getAppModeFromLocation(windowLocation: Location): AppMode {
  try {
    const hostname = String(windowLocation.hostname || '').toLowerCase();
    const igniteHostname = String(
      (import.meta as any)?.env?.VITE_IGNITE_HOSTNAME || 'clients.ignitegtm.com'
    ).toLowerCase();
    if (hostname === igniteHostname) return 'ignite';
    return hostname.startsWith('jobs.') ? 'job_seeker' : 'recruiter';
  } catch {
    return 'recruiter';
  }
}

export function useAppMode(): AppMode {
  // Stable value derived from current location; no re-render needed
  const mode =
    typeof window !== 'undefined'
      ? getAppModeFromLocation(window.location)
      : 'recruiter';
  return mode;
}
