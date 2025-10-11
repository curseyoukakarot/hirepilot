import { supabase } from '../lib/supabase';
import type { ParsedResume } from './resumeParser';

export async function ingestCandidateFromParsed({
  userId,
  orgId,
  filePublicUrl,
  parsed
}: {
  userId: string;
  orgId?: string | null;
  filePublicUrl?: string | null;
  parsed: ParsedResume;
}): Promise<{ candidateId: string }>{
  // 1) Dedup by email or linkedin
  let existingId: string | null = null;
  if (parsed.email) {
    const { data: exist } = await supabase
      .from('candidates')
      .select('id')
      .eq('user_id', userId)
      .ilike('email', parsed.email)
      .maybeSingle();
    existingId = exist?.id || null;
  }
  if (!existingId && parsed.linkedin) {
    const { data: exist } = await supabase
      .from('candidates')
      .select('id')
      .eq('user_id', userId)
      .ilike('linkedin_url', `%${parsed.linkedin.replace(/^https?:\/\//,'').replace(/www\./,'')}%`)
      .maybeSingle();
    existingId = exist?.id || null;
  }

  const nameParts = (parsed.name || '').split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ');

  // 2) Upsert candidate row
  let candidateId: string;
  if (existingId) {
    const { data, error } = await supabase
      .from('candidates')
      .update({
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        title: parsed.title || undefined,
        email: parsed.email || undefined,
        phone: parsed.phone || undefined,
        linkedin_url: parsed.linkedin || undefined,
        resume_url: filePublicUrl || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingId)
      .eq('user_id', userId)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    candidateId = data.id;
  } else {
    const { data, error } = await supabase
      .from('candidates')
      .insert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        title: parsed.title || null,
        email: parsed.email || `unknown+${userId.slice(0,8)}+${Date.now()}@noemail.hirepilot`,
        phone: parsed.phone || null,
        linkedin_url: parsed.linkedin || null,
        resume_url: filePublicUrl || null,
        status: 'sourced',
        enrichment_data: {}
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    candidateId = data.id;
  }

  // 3) Upsert contact info
  await supabase
    .from('candidate_contact')
    .upsert({
      candidate_id: candidateId,
      email: parsed.email || null,
      phone: parsed.phone || null,
      linkedin_url: parsed.linkedin || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'candidate_id' });

  // 4) Replace experiences/education if present
  if (parsed.experiences?.length) {
    await supabase.from('candidate_experience').delete().eq('candidate_id', candidateId);
    const rows = parsed.experiences.map(e => ({
      candidate_id: candidateId,
      company: e.company || null,
      title: e.title || null,
      start_date: e.start ? (new Date(e.start).toISOString().slice(0,10)) : null,
      end_date: e.end ? (new Date(e.end).toISOString().slice(0,10)) : null,
      location: e.location || null,
      description: e.description || null
    }));
    if (rows.length) await supabase.from('candidate_experience').insert(rows);
  }

  if (parsed.education?.length) {
    await supabase.from('candidate_education').delete().eq('candidate_id', candidateId);
    const rows = parsed.education.map(ed => ({
      candidate_id: candidateId,
      school: ed.school || null,
      degree: ed.degree || null,
      field: ed.field || null,
      start_year: ed.startYear || null,
      end_year: ed.endYear || null
    }));
    if (rows.length) await supabase.from('candidate_education').insert(rows);
  }

  // 5) Upsert skills and tech
  if (parsed.skills?.length) {
    await supabase.from('candidate_skill').delete().eq('candidate_id', candidateId);
    const rows = Array.from(new Set(parsed.skills)).map(s => ({ candidate_id: candidateId, skill: s }));
    if (rows.length) await supabase.from('candidate_skill').insert(rows);
  }
  if (parsed.tech?.length) {
    await supabase.from('candidate_tech_stack').delete().eq('candidate_id', candidateId);
    const rows = Array.from(new Set(parsed.tech)).map(t => ({ candidate_id: candidateId, tech: t }));
    if (rows.length) await supabase.from('candidate_tech_stack').insert(rows);
  }

  // 6) Save raw
  await supabase
    .from('candidate_resume_raw')
    .upsert({
      candidate_id: candidateId,
      raw_json: parsed.raw || {},
      parser_version: parsed.parserVersion,
      created_at: new Date().toISOString()
    }, { onConflict: 'candidate_id' });

  return { candidateId };
}


