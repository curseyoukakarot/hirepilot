export interface ParsedResumeExperience {
  company?: string;
  title?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
}

export interface ParsedResumeEducation {
  school?: string;
  degree?: string;
  field?: string;
  startYear?: number;
  endYear?: number;
}

export interface ParsedResume {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  skills?: string[];
  tech?: string[];
  summary?: string;
  experiences: ParsedResumeExperience[];
  education: ParsedResumeEducation[];
  raw: any;
  parserVersion: string;
}

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;
// More permissive phone (accept international and digits with spaces)
export const PHONE_RE = /(\+?\d{1,3}[\s\-.]?)?(\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{3,4}/g;
export const LINKEDIN_RE = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-z0-9\-_%]+/ig;

const KNOWN_TECH = ['javascript','typescript','react','node','python','java','aws','gcp','azure','kubernetes','docker','postgres','redis','salesforce','hubspot','next.js','nestjs','graphql','go','ruby','rails','php','laravel','mysql','mongodb','snowflake','redshift','bigquery'];

export function extractTech(text: string): string[] {
  const lower = (text || '').toLowerCase();
  return KNOWN_TECH.filter(k => lower.includes(k));
}

export function basicParseFromText(plainText: string): ParsedResume {
  const text = plainText || '';
  const emails = Array.from(text.match(EMAIL_RE) || []);
  const phones = Array.from(text.match(PHONE_RE) || []);
  const linkedins = Array.from(text.match(LINKEDIN_RE) || []);

  // Heuristic name: first non-empty line; title from subsequent line with keywords
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // If first line is PDF header or non-alpha, skip until a line with alphabetic characters and spaces
  let name: string | undefined = undefined;
  for (const l of lines) {
    if (/^[A-Za-z][A-Za-z\s\-\.'`]{1,}$/.test(l)) { name = l; break; }
  }
  const titleCandidate = (lines.find(l => /(engineer|developer|manager|designer|analyst|recruiter|sales|founder|cto|cmo|ceo|lead)/i.test(l)) || '').trim();

  // Very simple experience extraction by headings
  const experiences: ParsedResumeExperience[] = [];
  const education: ParsedResumeEducation[] = [];

  // Try to chunk by sections
  const textLower = text.toLowerCase();
  const expIdx = Math.max(textLower.indexOf('experience'), textLower.indexOf('work experience'));
  const eduIdx = textLower.indexOf('education');
  const expText = expIdx >= 0 ? text.slice(expIdx, eduIdx > expIdx ? eduIdx : undefined) : '';
  const eduText = eduIdx >= 0 ? text.slice(eduIdx) : '';

  // Naive experience lines as bullets
  expText.split(/\n+/).forEach(line => {
    const m = line.match(/^(\*|-|•)?\s*(.+?)\s+at\s+(.+?)\s*(\(|\-|,|$)/i);
    if (m) {
      experiences.push({ title: m[2], company: m[3] });
    }
  });

  // Naive education lines
  eduText.split(/\n+/).forEach(line => {
    const m = line.match(/^(\*|-|•)?\s*(.+?),\s*(.+?)(?:,\s*(\d{4}))(?:\s*-\s*(\d{4}|present))?/i);
    if (m) {
      education.push({ school: m[2], degree: m[3], startYear: m[4] ? Number(m[4]) : undefined, endYear: m[5] && m[5] !== 'present' ? Number(m[5]) : undefined });
    }
  });

  const tech = extractTech(text);

  return {
    name,
    title: titleCandidate || undefined,
    email: emails[0]?.toLowerCase(),
    phone: phones[0],
    linkedin: linkedins[0] || undefined,
    skills: Array.from(new Set(tech)),
    tech: Array.from(new Set(tech)),
    summary: undefined,
    experiences,
    education,
    raw: { text },
    parserVersion: '1.0.0-basic'
  };
}


