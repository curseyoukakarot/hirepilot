export interface TokenDictionary {
  [key: string]: any;
}

// Replaces tokens like {{first_name}} or {{Candidate.FirstName}} in template string
export function replaceTokens(template: string, data: TokenDictionary): string {
  if (!template) return '';

  const resolvePath = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
  };

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
    let value = resolvePath(data, path);

    // Fallback alias mapping for common short tokens -> Candidate.*
    if (value === undefined || value === null) {
      switch (path) {
        case 'first_name':
          value = resolvePath(data, 'Candidate.FirstName');
          break;
        case 'last_name':
          value = resolvePath(data, 'Candidate.LastName');
          break;
        case 'full_name': {
          const fn = resolvePath(data, 'Candidate.FirstName') || '';
          const ln = resolvePath(data, 'Candidate.LastName') || '';
          value = `${fn} ${ln}`.trim();
          break;
        }
        case 'company':
          value = resolvePath(data, 'Candidate.Company');
          break;
        case 'title':
          value = resolvePath(data, 'Candidate.Job');
          break;
        case 'email':
          value = resolvePath(data, 'Candidate.Email');
          break;
        default:
          // leave value undefined so we fall through
      }
    }

    return value !== undefined && value !== null && value !== '' ? String(value) : match;
  });
} 