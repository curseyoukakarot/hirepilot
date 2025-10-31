/*
  Backfill lead.location for old records where it may be empty.

  Strategy (non-destructive):
  - Compute bestLocation from, in order:
    1) city/state/country
    2) campaign_location
    3) existing location (if any)
    4) enrichment_data.location or enrichment_data.apollo.location
  - Only update the string 'location' column. We DO NOT modify city/state/country.
  - Batched pagination to handle large tables safely.

  Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node backend/scripts/backfill-lead-location.js
*/

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');

function getEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

function computeBestLocation(row) {
  const parts = [row.city, row.state, row.country]
    .map((x) => (typeof x === 'string' ? x.trim() : x))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (row.campaign_location && String(row.campaign_location).trim() !== '') return row.campaign_location;
  if (row.location && String(row.location).trim() !== '') return row.location;
  // Try enrichment_data
  let enrichment = row.enrichment_data;
  if (!enrichment) return null;
  try {
    if (typeof enrichment === 'string') enrichment = JSON.parse(enrichment);
  } catch (_) {
    // ignore parse errors
  }
  const enriched =
    (enrichment && (enrichment.location || enrichment?.apollo?.location)) || null;
  return enriched && String(enriched).trim() !== '' ? enriched : null;
}

async function run() {
  const PAGE_SIZE = 1000;
  let from = 0;
  let totalUpdated = 0;

  console.log('Starting backfill of lead.location...');

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data: rows, error } = await supabase
      .from('leads')
      .select('id, city, state, country, campaign_location, location, enrichment_data')
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const updates = [];
    for (const row of rows) {
      const best = computeBestLocation(row);
      const existing = (row.location || '').trim();
      if (best && best !== existing) {
        updates.push({ id: row.id, location: best, updated_at: new Date().toISOString() });
      }
    }

    if (updates.length > 0) {
      // Chunk upserts to avoid payload limits
      const CHUNK = 500;
      for (let i = 0; i < updates.length; i += CHUNK) {
        const slice = updates.slice(i, i + CHUNK);
        const { error: upsertError } = await supabase
          .from('leads')
          .upsert(slice, { onConflict: 'id' });
        if (upsertError) throw upsertError;
        totalUpdated += slice.length;
      }
      console.log(`Updated ${totalUpdated} lead(s) so far...`);
    }

    if (rows.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  console.log(`Backfill complete. Total leads updated: ${totalUpdated}`);
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});


