import { supabaseDb } from '../lib/supabase';

type OutreachOptions = {
  note: string;
  tags?: string[];
  timestamp?: string;
};

export async function logLeadOutreachActivities(leadIds: string[], userId: string, options: OutreachOptions) {
  try {
    if (!Array.isArray(leadIds) || !leadIds.length || !userId) return;
    const now = new Date().toISOString();
    const rows = leadIds.map(leadId => ({
      lead_id: leadId,
      user_id: userId,
      activity_type: 'Outreach',
      tags: options.tags || [],
      notes: options.note || null,
      activity_timestamp: options.timestamp || now,
      created_at: now,
      updated_at: now
    }));
    await supabaseDb.from('lead_activities').insert(rows);
  } catch (error) {
    console.warn('[activityLogger] Failed to log outreach activities', error);
  }
}

