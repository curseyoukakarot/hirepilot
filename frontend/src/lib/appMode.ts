export type AppMode = 'recruiter' | 'job_seeker';

export function getAppModeFromLocation(windowLocation: Location): AppMode {
  try {
    return windowLocation.hostname.startsWith('jobs.')
      ? 'job_seeker'
      : 'recruiter';
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
