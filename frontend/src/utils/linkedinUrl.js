/**
 * Normalize a LinkedIn profile URL for use in connect flows and links.
 * Accepts common inputs like:
 *   - "linkedin.com/in/jane"                -> "https://www.linkedin.com/in/jane"
 *   - "www.linkedin.com/in/jane"            -> "https://www.linkedin.com/in/jane"
 *   - "http://linkedin.com/in/jane/"        -> "https://www.linkedin.com/in/jane"
 *   - "https://www.linkedin.com/in/jane?x=1"-> "https://www.linkedin.com/in/jane"
 *   - "/in/jane"                            -> "https://www.linkedin.com/in/jane"
 *
 * Returns null for anything that can't be resolved to a /in/ profile URL.
 */
export function normalizeLinkedInProfileUrl(input) {
  let s = String(input || '').trim();
  if (!s) return null;

  // Bare path: "/in/jane" or "in/jane"
  if (s.startsWith('/in/')) {
    s = 'https://www.linkedin.com' + s;
  } else if (/^in\//i.test(s)) {
    s = 'https://www.linkedin.com/' + s;
  }

  // Protocol handling
  if (/^http:\/\//i.test(s)) {
    s = 'https://' + s.slice(7);
  } else if (/^https:\/\//i.test(s)) {
    // keep
  } else if (/^www\./i.test(s)) {
    s = 'https://' + s;
  } else if (/^linkedin\.com\//i.test(s)) {
    s = 'https://' + s;
  } else if (!/^https?:\/\//i.test(s)) {
    return null;
  }

  // Strip query and fragment
  const qIdx = s.indexOf('?');
  const hIdx = s.indexOf('#');
  if (qIdx >= 0) s = s.slice(0, qIdx);
  if (hIdx >= 0) s = s.slice(0, hIdx);

  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  const host = (url.hostname || '').toLowerCase();
  if (host !== 'linkedin.com' && host !== 'www.linkedin.com' && !host.endsWith('.linkedin.com')) {
    return null;
  }

  const path = (url.pathname || '').toLowerCase();
  if (!path.includes('/in/')) return null;
  if (path.includes('/jobs/') || path.includes('/company/') || path.includes('/learning/')) {
    return null;
  }

  const cleanPath = url.pathname.replace(/\/+$/, '') || '/';
  return `https://www.linkedin.com${cleanPath}`;
}
