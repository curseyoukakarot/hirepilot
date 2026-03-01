/**
 * Normalizes a LinkedIn profile URL for connection-request flows.
 * Returns null for invalid or non-profile URLs (e.g. /jobs/, /company/, etc).
 */
export function normalizeLinkedinProfileUrl(input: string): string | null {
  let s = String(input || '').trim();
  if (!s) return null;

  // 3) http:// -> https://
  if (s.toLowerCase().startsWith('http://')) {
    s = 'https://' + s.slice(7);
  } else if (s.toLowerCase().startsWith('https://')) {
    // 6) keep https://
  } else if (s.toLowerCase().startsWith('www.')) {
    // 4) www. -> prefix https://
    s = 'https://' + s;
  } else if (s.toLowerCase().startsWith('linkedin.com/')) {
    // 5) linkedin.com/ -> prefix https://
    s = 'https://' + s;
  } else {
    // Must have a recognized prefix
    return null;
  }

  // 9) Strip query params and fragment
  const qIdx = s.indexOf('?');
  const hIdx = s.indexOf('#');
  if (qIdx >= 0) s = s.slice(0, qIdx);
  if (hIdx >= 0) s = s.slice(0, hIdx);

  try {
    const url = new URL(s);
    const host = url.hostname.toLowerCase();

    // 7) Hostname must end with linkedin.com or www.linkedin.com
    if (host !== 'linkedin.com' && host !== 'www.linkedin.com') {
      return null;
    }

    // 8) Must look like a profile path: contains /in/ and not /jobs/ etc
    const path = url.pathname.toLowerCase();
    if (!path.includes('/in/')) return null;
    if (path.includes('/jobs/') || path.includes('/company/') || path.includes('/learning/')) {
      return null;
    }

    // Build clean canonical URL (strip trailing slash)
    const cleanPath = url.pathname.replace(/\/+$/, '') || '/';
    const canonical = `https://www.linkedin.com${cleanPath}`;
    return canonical;
  } catch {
    return null;
  }
}
