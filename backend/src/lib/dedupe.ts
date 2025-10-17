import { supabaseAdmin } from './supabaseAdmin';

export async function dedupeLeadsForUser(userId: string, leads: any[]): Promise<any[]> {
  if (!Array.isArray(leads) || leads.length === 0) return [];
  const emails = Array.from(new Set(leads.map((l) => (l.email || '').toLowerCase()).filter(Boolean)));
  const urls = Array.from(new Set(leads.map((l) => (l.linkedin_url || l.profile_url || '').toLowerCase()).filter(Boolean)));

  const existingEmails = new Set<string>();
  const existingUrls = new Set<string>();

  if (emails.length > 0) {
    const { data } = await supabaseAdmin
      .from('leads')
      .select('email')
      .eq('user_id', userId)
      .in('email', emails);
    (data || []).forEach((r: any) => existingEmails.add(String(r.email || '').toLowerCase()));
  }
  if (urls.length > 0) {
    const { data } = await supabaseAdmin
      .from('leads')
      .select('linkedin_url')
      .eq('user_id', userId)
      .in('linkedin_url', urls);
    (data || []).forEach((r: any) => existingUrls.add(String(r.linkedin_url || '').toLowerCase()));
  }

  const filtered: any[] = [];
  const seenEmails = new Set<string>();
  const seenUrls = new Set<string>();

  for (const l of leads) {
    const email = String(l.email || '').toLowerCase();
    const url = String(l.linkedin_url || l.profile_url || '').toLowerCase();
    if (email) {
      if (existingEmails.has(email) || seenEmails.has(email)) continue;
      seenEmails.add(email);
    } else if (url) {
      if (existingUrls.has(url) || seenUrls.has(url)) continue;
      seenUrls.add(url);
    }
    filtered.push(l);
  }

  return filtered;
}


