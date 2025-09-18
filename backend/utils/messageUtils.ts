interface Lead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  company?: string;
  title?: string;
  [key: string]: any;
}

function toTitleCase(s: string): string {
  if (!s) return s;
  return s
    .toLowerCase()
    .replace(/(^|\s|[._-])([a-z])/g, (_m, p1: string, p2: string) => (p1 ? p1.replace(/[._-]/g, ' ') : '') + p2.toUpperCase())
    .trim();
}

function deriveNames(lead: Lead): { first: string; last: string; full: string } {
  // Prefer explicit fields
  let first = lead.first_name || lead.firstName || '';
  let last = lead.last_name || lead.lastName || '';

  // Fallback to split name
  if ((!first || !last) && lead.name) {
    const parts = String(lead.name).trim().split(/\s+/).filter(Boolean);
    if (!first && parts.length > 0) first = parts[0];
    if (!last && parts.length > 1) last = parts.slice(1).join(' ');
  }

  // Fallback to parse from email local part
  if (!first && lead.email) {
    const local = String(lead.email).split('@')[0] || '';
    const splitLocal = local.split(/[._-]+/).filter(Boolean);
    if (splitLocal.length > 0) first = splitLocal[0];
    if (splitLocal.length > 1 && !last) last = splitLocal.slice(1).join(' ');
  }

  // Normalize casing
  first = toTitleCase(first);
  last = toTitleCase(last);

  const full = `${first || ''} ${last || ''}`.trim();
  return { first, last, full };
}

export function personalizeMessage(template: string, lead: Lead): string {
  const { first, last, full } = deriveNames(lead);

  // Build an augmented object with common aliases
  const augmented = {
    ...lead,
    first_name: first || lead.first_name || lead.firstName || '',
    last_name: last || lead.last_name || lead.lastName || '',
    full_name: full || `${lead.first_name || lead.firstName || ''} ${lead.last_name || lead.lastName || ''}`.trim(),
    firstName: first || lead.firstName || lead.first_name || '',
    lastName: last || lead.lastName || lead.last_name || '',
    fullName: full || `${lead.firstName || lead.first_name || ''} ${lead.lastName || lead.last_name || ''}`.trim(),
    company: lead.company || '',
    title: lead.title || '',
    email: lead.email || ''
  } as Record<string, any>;

  // Provide Candidate.* namespace for template compatibility (frontend uses {{Candidate.FirstName}} etc.)
  augmented.Candidate = {
    FirstName: augmented.first_name,
    LastName: augmented.last_name,
    Company: augmented.company,
    Job: augmented.title,
    Email: augmented.email,
    LinkedIn: (lead as any)?.linkedin_url || (lead as any)?.linkedin || null
  };

  // First pass: quick replacements for common variables (snake_case and camelCase)
  const commonKeys = [
    'first_name','last_name','full_name',
    'firstName','lastName','fullName',
    'company','title','email'
  ];

  let message = template;
  for (const key of commonKeys) {
    const value = String(augmented[key] ?? '');
    const re = new RegExp(`\\{\\{\n?\t?\u0020*${key}\u0020*\n?\t?\\}}`,'g');
    message = message.replace(re, value);
  }

  // Second pass: support nested/dot-notation lookups against the augmented lead
  message = message.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
    const value = path.split('.').reduce((acc: any, part: string) => (acc ? acc[part] : undefined), augmented);
    return (value !== undefined && value !== null) ? String(value) : _match;
  });

  return message;
}