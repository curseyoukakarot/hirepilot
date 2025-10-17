export type PersonaInput = {
  name: string;
  titles: string[];
  include_keywords: string[];
  exclude_keywords: string[];
  locations: string[];
  channels: string[];
  goal_total_leads?: number;
};

function normalizeList(list?: any[]): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' '));
}

export function buildSourcingQuery(persona: PersonaInput) {
  const titles = normalizeList(persona.titles);
  const include = normalizeList(persona.include_keywords);
  const exclude = normalizeList(persona.exclude_keywords);
  const locations = normalizeList(persona.locations);
  return {
    title_query: titles,
    keyword_includes: include,
    keyword_excludes: exclude,
    locations
  };
}


